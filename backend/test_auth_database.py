"""Additional SQLite/authentication regression tests for Finora."""
import os
import tempfile
import unittest

import app as finora
from app import app


class AuthDatabaseRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        app.config.update(TESTING=True, DATABASE=os.path.join(self.temp.name, "auth-db-test.sqlite3"))
        with app.app_context():
            finora.init_db()
            finora.init_db()  # Initialization must be safe to repeat.
        self.client = app.test_client()
        response = self.client.post("/api/auth/register", json={
            "name": "Auth Test", "email": "auth@example.test", "password": "strong-test-password"
        })
        self.assertEqual(response.status_code, 201)
        self.token = response.get_json()["token"]
        self.user_id = response.get_json()["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        self.temp.cleanup()

    def test_session_token_is_not_stored_in_plaintext(self):
        with app.app_context():
            row = finora.get_db().execute("SELECT token_hash FROM auth_sessions WHERE user_id=?", (self.user_id,)).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["token_hash"], finora.token_digest(self.token))
        self.assertNotEqual(row["token_hash"], self.token)

    def test_expired_session_is_rejected_and_removed(self):
        with app.app_context():
            db = finora.get_db()
            db.execute("UPDATE auth_sessions SET expires_at=? WHERE token_hash=?", ("2000-01-01T00:00:00+00:00", finora.token_digest(self.token)))
            db.commit()
        response = self.client.get("/api/auth/me", headers=self.headers)
        self.assertEqual(response.status_code, 401)
        with app.app_context():
            remaining = finora.get_db().execute("SELECT COUNT(*) FROM auth_sessions WHERE token_hash=?", (finora.token_digest(self.token),)).fetchone()[0]
        self.assertEqual(remaining, 0)

    def test_invalid_bearer_token_is_rejected(self):
        response = self.client.get("/api/accounts", headers={"Authorization": "Bearer definitely-not-valid"})
        self.assertEqual(response.status_code, 401)

    def test_resource_identifier_sql_injection_does_not_bypass_ownership(self):
        conversation = self.client.post("/api/conversations", json={}, headers=self.headers).get_json()["id"]
        injected = "' OR '1'='1"
        response = self.client.get(f"/api/conversations/{injected}/messages", headers=self.headers)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get(f"/api/conversations/{conversation}/messages", headers=self.headers).status_code, 200)

    def test_message_role_constraint_rejects_untrusted_role(self):
        conversation = self.client.post("/api/conversations", json={}, headers=self.headers).get_json()["id"]
        with app.app_context():
            db = finora.get_db()
            with self.assertRaises(Exception):
                db.execute(
                    "INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)",
                    ("bad-role", conversation, "system", "not allowed", finora.utc_now()),
                )

    def test_deleting_user_cascades_sessions_and_demo_records(self):
        with app.app_context():
            db = finora.get_db()
            self.assertGreater(db.execute("SELECT COUNT(*) FROM demo_banking_data WHERE user_id=?", (self.user_id,)).fetchone()[0], 0)
            db.execute("DELETE FROM users WHERE id=?", (self.user_id,))
            db.commit()
            self.assertEqual(db.execute("SELECT COUNT(*) FROM auth_sessions WHERE user_id=?", (self.user_id,)).fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM demo_banking_data WHERE user_id=?", (self.user_id,)).fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
