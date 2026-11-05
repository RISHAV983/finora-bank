"""Integration tests for authenticated SQLite-backed chatbot context."""
import os
import tempfile
import unittest
from unittest.mock import patch

import app as finora
from app import app


class ChatbotDatabaseContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        app.config.update(TESTING=True, DATABASE=os.path.join(self.temp.name, "chatbot-test.sqlite3"))
        with app.app_context():
            finora.init_db()
        self.client = app.test_client()
        response = self.client.post("/api/auth/register", json={
            "name": "Primary Demo", "email": "primary@example.test", "password": "test-password-123"
        })
        self.assertEqual(response.status_code, 201)
        self.user = response.get_json()["user"]
        self.headers = {"Authorization": f"Bearer {response.get_json()['token']}"}
        self.conversation_id = self.client.post(
            "/api/conversations", json={}, headers=self.headers
        ).get_json()["id"]

    def tearDown(self):
        self.temp.cleanup()

    def chat_and_context(self, message, extra_payload=None):
        payload = {"message": message, "conversationId": self.conversation_id}
        payload.update(extra_payload or {})
        with patch("app.generate_llm_reply", return_value="Mocked LLM response") as generate:
            response = self.client.post("/api/chat", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.get_json())
        return generate.call_args.args[2]

    def test_database_contains_owned_seed_records_for_first_demo_user(self):
        with app.app_context():
            db = finora.get_db()
            counts = dict(db.execute(
                "SELECT resource_type,COUNT(*) AS count FROM demo_banking_data WHERE user_id=? GROUP BY resource_type",
                (self.user["id"],),
            ).fetchall())
        self.assertGreater(counts.get("accounts", 0), 0)
        self.assertGreater(counts.get("transactions", 0), 0)
        self.assertGreater(counts.get("bills", 0), 0)

    def test_balance_question_uses_sqlite_accounts_not_python_fixture_list(self):
        context = self.chat_and_context("What is my current account balance?")
        self.assertEqual(len(context["accounts"]), 2)
        self.assertAlmostEqual(context["accounts"][0]["balance"], 12840.55)
        self.assertEqual(context["recent_transactions"], [])
        self.assertNotIn("lastFour", context["accounts"][0])

    def test_chatbot_uses_updated_sqlite_record_instead_of_python_fixture(self):
        import json
        with app.app_context():
            db = finora.get_db()
            row = db.execute(
                "SELECT data_json FROM demo_banking_data WHERE user_id=? AND resource_type='accounts' AND resource_id='CHK-001'",
                (self.user["id"],),
            ).fetchone()
            record = json.loads(row["data_json"])
            record["balance"] = 9876.54
            db.execute(
                "UPDATE demo_banking_data SET data_json=? WHERE user_id=? AND resource_type='accounts' AND resource_id='CHK-001'",
                (json.dumps(record), self.user["id"]),
            )
            db.commit()
        context = self.chat_and_context("What is my current account balance?")
        self.assertAlmostEqual(context["accounts"][0]["balance"], 9876.54)

    def test_context_carries_precomputed_totals_matching_the_dashboard(self):
        context = self.chat_and_context("What is my current account balance?")
        self.assertAlmostEqual(context["account_totals"]["total_balance"], 37340.55)
        self.assertEqual(context["account_totals"]["account_count"], 2)
        self.assertEqual(context["today"], finora.date.today().isoformat())
        spending = self.chat_and_context("How much have I spent in total?")
        self.assertAlmostEqual(spending["all_time_debit_total"], 532.13)

    def test_transaction_question_returns_only_transaction_context(self):
        context = self.chat_and_context("Show my five most recent transactions")
        self.assertEqual(len(context["recent_transactions"]), 10)
        self.assertEqual(context["accounts"], [])
        self.assertEqual(context["recent_transactions"][0]["description"], "Salary Deposit")

    def test_monthly_spending_summary_is_calculated_from_sqlite_rows(self):
        context = self.chat_and_context("How much did I spend this month?")
        month = finora.date.today().strftime("%Y-%m")
        # Seed dates are relative to today, so derive the expectation from the user's own stored rows.
        with app.app_context():
            rows = finora.get_db().execute(
                "SELECT data_json FROM demo_banking_data WHERE user_id=? AND resource_type='transactions'",
                (self.user["id"],),
            ).fetchall()
        records = [finora.json.loads(row["data_json"]) for row in rows]
        this_month = [t for t in records if t["date"].startswith(month)]
        expected = round(sum(abs(t["amount"]) for t in this_month if t["type"] == "debit"), 2)
        self.assertIn("monthly_spending", context)
        self.assertEqual(context["monthly_spending"]["period"], month)
        self.assertEqual(context["monthly_spending"]["has_records"], bool(this_month))
        self.assertEqual(context["monthly_spending"]["transaction_count"], len(this_month))
        self.assertAlmostEqual(context["monthly_spending"]["debit_total"], expected)

    def test_seeded_transactions_match_the_frontend_fixture_count_and_are_recent(self):
        with app.app_context():
            rows = finora.get_db().execute(
                "SELECT data_json FROM demo_banking_data WHERE user_id=? AND resource_type='transactions'",
                (self.user["id"],),
            ).fetchall()
        dates = [finora.json.loads(row["data_json"])["date"] for row in rows]
        self.assertEqual(len(dates), 10)
        self.assertLessEqual(max(dates), finora.date.today().isoformat())
        self.assertGreaterEqual(min(dates), (finora.date.today() - finora.timedelta(days=30)).isoformat())

    def test_bills_question_uses_database_backed_bill_records(self):
        context = self.chat_and_context("Which bills are pending?")
        self.assertGreater(len(context["bills"]), 0)
        self.assertTrue(all(bill["status"] == "Pending" for bill in context["bills"]))
        self.assertEqual(context["accounts"], [])

    def test_second_user_receives_only_their_own_banking_context(self):
        response = self.client.post("/api/auth/register", json={
            "name": "Second Demo", "email": "second@example.test", "password": "test-password-123"
        })
        self.assertEqual(response.status_code, 201)
        second = response.get_json()
        second_headers = {"Authorization": f"Bearer {second['token']}"}
        second_conversation = self.client.post(
            "/api/conversations", json={}, headers=second_headers
        ).get_json()["id"]
        with app.app_context():
            db = finora.get_db()
            db.execute("UPDATE demo_banking_data SET data_json=json_set(data_json,'$.balance',42.0) "
                       "WHERE user_id=? AND resource_type='accounts'", (second["user"]["id"],))
            db.commit()
        with patch("app.generate_llm_reply", return_value="ok") as generate:
            chat = self.client.post("/api/chat", json={
                "message": "Summarize all my finances", "conversationId": second_conversation,
                "userId": self.user["id"],  # client-supplied identity must be ignored
            }, headers=second_headers)
        self.assertEqual(chat.status_code, 200)
        context = generate.call_args.args[2]
        self.assertGreater(len(context["accounts"]), 0)
        self.assertTrue(all(account["balance"] == 42.0 for account in context["accounts"]))
        self.assertGreater(len(context["bills"]), 0)

    def test_users_created_before_this_fix_are_backfilled(self):
        with app.app_context():
            db = finora.get_db()
            cursor = db.execute("INSERT INTO users(name,email,password_hash,created_at) VALUES('Legacy','legacy@example.test','x','2026-01-01')")
            legacy_id = cursor.lastrowid; db.commit()
            finora.init_db()
            owned = db.execute("SELECT COUNT(*) FROM resource_ownership WHERE user_id=?", (legacy_id,)).fetchone()[0]
            stored = db.execute("SELECT COUNT(*) FROM demo_banking_data WHERE user_id=?", (legacy_id,)).fetchone()[0]
        total = sum(len(records) for records in finora.RESOURCES.values())
        self.assertEqual((owned, stored), (total, total))

    def test_combined_question_retrieves_each_requested_category(self):
        context = self.chat_and_context("Show my balance and my recent transactions")
        self.assertGreater(len(context["accounts"]), 0)
        self.assertGreater(len(context["recent_transactions"]), 0)

    def test_sqlite_context_failure_returns_safe_service_error(self):
        import sqlite3
        with patch("app.get_user_demo_context", side_effect=sqlite3.OperationalError("private database detail")):
            response = self.client.post("/api/chat", json={
                "message": "What is my balance?", "conversationId": self.conversation_id
            }, headers=self.headers)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["code"], "banking_data_unavailable")
        self.assertNotIn("private database detail", response.get_data(as_text=True))

    def test_unknown_question_does_not_send_unnecessary_banking_records(self):
        context = self.chat_and_context("How do I navigate to the profile page?")
        self.assertEqual(context["accounts"], [])
        self.assertEqual(context["recent_transactions"], [])
        self.assertEqual(context["bills"], [])

    def test_existing_database_is_backfilled_for_its_existing_owner(self):
        with app.app_context():
            db = finora.get_db()
            db.execute("DELETE FROM demo_banking_data WHERE user_id=?", (self.user["id"],))
            db.commit()
            finora.init_db()
            count = db.execute("SELECT COUNT(*) FROM demo_banking_data WHERE user_id=?", (self.user["id"],)).fetchone()[0]
        self.assertGreater(count, 0)


if __name__ == "__main__":
    unittest.main()
