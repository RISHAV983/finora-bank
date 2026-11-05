import os
import tempfile
import unittest
from unittest.mock import patch

import app as finora
from app import app

LIMIT_KEYS = ("RATE_LIMIT_REGISTER_PER_HOUR", "RATE_LIMIT_LOGIN_PER_IP", "RATE_LIMIT_LOGIN_PER_ACCOUNT",
              "RATE_LIMIT_CHAT_PER_MINUTE", "RATE_LIMIT_CHAT_PER_DAY")


class RateLimitTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.saved = {k: app.config[k] for k in LIMIT_KEYS}
        app.config.update(TESTING=True, DATABASE=os.path.join(self.temp.name, "rl.sqlite3"))
        with app.app_context():
            finora.init_db()
        self.client = app.test_client()

    def tearDown(self):
        app.config.update(self.saved)
        self.temp.cleanup()

    def register(self, email, **kwargs):
        return self.client.post("/api/auth/register", json={"name": "T", "email": email, "password": "test-password-123"}, **kwargs)

    def test_register_is_limited_per_ip_and_reports_retry_after(self):
        app.config["RATE_LIMIT_REGISTER_PER_HOUR"] = 2
        self.assertEqual(self.register("a@example.com").status_code, 201)
        self.assertEqual(self.register("b@example.com").status_code, 201)
        blocked = self.register("c@example.com")
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.get_json()["code"], "rate_limited")
        self.assertGreaterEqual(int(blocked.headers["Retry-After"]), 1)
        self.assertEqual(blocked.get_json()["retryAfter"], int(blocked.headers["Retry-After"]))

    def test_different_client_ips_have_separate_register_limits(self):
        app.config["RATE_LIMIT_REGISTER_PER_HOUR"] = 1
        self.assertEqual(self.register("a@example.com", environ_base={"REMOTE_ADDR": "10.0.0.1"}).status_code, 201)
        self.assertEqual(self.register("b@example.com", environ_base={"REMOTE_ADDR": "10.0.0.1"}).status_code, 429)
        self.assertEqual(self.register("c@example.com", environ_base={"REMOTE_ADDR": "10.0.0.2"}).status_code, 201)

    def test_login_is_limited_per_account_without_locking_other_accounts(self):
        self.register("victim@example.com"); self.register("other@example.com")
        app.config["RATE_LIMIT_LOGIN_PER_ACCOUNT"] = 3
        for _ in range(3):
            self.assertEqual(self.client.post("/api/auth/login", json={"email": "victim@example.com", "password": "wrong-password"}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "victim@example.com", "password": "wrong-password"}).status_code, 429)
        # Even the correct password is refused while limited, so guessing cannot continue.
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "VICTIM@example.com", "password": "test-password-123"}).status_code, 429)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "other@example.com", "password": "test-password-123"}).status_code, 200)

    def test_login_is_limited_per_ip_across_many_emails(self):
        app.config["RATE_LIMIT_LOGIN_PER_IP"] = 4
        codes = [self.client.post("/api/auth/login", json={"email": f"user{i}@example.com", "password": "x"}).status_code for i in range(6)]
        self.assertEqual(codes, [401, 401, 401, 401, 429, 429])

    def chat_headers(self, email="chat@example.com"):
        token = self.register(email).get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        conversation = self.client.post("/api/conversations", json={}, headers=headers).get_json()["id"]
        return headers, conversation

    def test_chat_per_minute_limit_blocks_before_calling_the_provider(self):
        headers, conversation = self.chat_headers()
        app.config["RATE_LIMIT_CHAT_PER_MINUTE"] = 2
        with patch("app.generate_llm_reply", return_value="ok") as generate:
            for _ in range(2):
                self.assertEqual(self.client.post("/api/chat", json={"message": "hi", "conversationId": conversation}, headers=headers).status_code, 200)
            blocked = self.client.post("/api/chat", json={"message": "hi", "conversationId": conversation}, headers=headers)
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.get_json()["code"], "chat_rate_limited")
        self.assertEqual(generate.call_count, 2)  # the limited request never reached the LLM

    def test_chat_daily_quota_is_per_user(self):
        headers, conversation = self.chat_headers("one@example.com")
        other_headers, other_conversation = self.chat_headers("two@example.com")
        app.config["RATE_LIMIT_CHAT_PER_DAY"] = 1
        with patch("app.generate_llm_reply", return_value="ok"):
            self.assertEqual(self.client.post("/api/chat", json={"message": "hi", "conversationId": conversation}, headers=headers).status_code, 200)
            blocked = self.client.post("/api/chat", json={"message": "hi", "conversationId": conversation}, headers=headers)
            self.assertEqual(blocked.status_code, 429)
            self.assertEqual(blocked.get_json()["code"], "chat_quota_exceeded")
            self.assertEqual(self.client.post("/api/chat", json={"message": "hi", "conversationId": other_conversation}, headers=other_headers).status_code, 200)

    def test_failed_validation_does_not_consume_chat_quota(self):
        headers, conversation = self.chat_headers()
        app.config["RATE_LIMIT_CHAT_PER_DAY"] = 1
        self.assertEqual(self.client.post("/api/chat", json={"message": "", "conversationId": conversation}, headers=headers).status_code, 400)
        with patch("app.generate_llm_reply", return_value="ok"):
            self.assertEqual(self.client.post("/api/chat", json={"message": "hi", "conversationId": conversation}, headers=headers).status_code, 200)

    def test_expired_windows_are_cleaned_up(self):
        with app.app_context():
            db = finora.get_db()
            db.execute("INSERT INTO rate_limits(bucket,window_start,count) VALUES('old',1,5)"); db.commit()
            finora.hit_rate_limit("fresh", 10, 60)
            self.assertIsNone(db.execute("SELECT 1 FROM rate_limits WHERE bucket='old'").fetchone())


if __name__ == "__main__":
    unittest.main()
