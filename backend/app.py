"""Finora demo API. Banking actions remain fictional and simulated."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from functools import wraps
from uuid import uuid4

from flask import Flask, jsonify, request, g
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import generate_password_hash, check_password_hash

from llm_service import (LLMAuthError, LLMConfigurationError, LLMProviderError, LLMQuotaError,
                         LLMRateLimitError, LLMTimeoutError, generate_reply as generate_llm_reply,
                         is_test_provider, llm_status, load_env)

load_env(Path(__file__).with_name(".env"))
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024
_database_setting = os.getenv("FINORA_DATABASE_PATH", "")
_database_path = Path(_database_setting) if _database_setting else Path(__file__).with_name("finora.sqlite3")
if _database_setting and not _database_path.is_absolute():
    _database_path = Path(__file__).parent / _database_path
app.config["DATABASE"] = str(_database_path)
app.config["SESSION_HOURS"] = int(os.getenv("FINORA_SESSION_HOURS", "12"))

def _int_env(name, default, minimum=1):
    try:
        return max(int(os.getenv(name, str(default))), minimum)
    except ValueError:
        return default

# Rate limits (fixed windows, counted in SQLite so every gunicorn worker shares them).
app.config.update(
    RATE_LIMIT_REGISTER_PER_HOUR=_int_env("FINORA_REGISTER_LIMIT", 5),            # per client IP
    RATE_LIMIT_LOGIN_PER_IP=_int_env("FINORA_LOGIN_IP_LIMIT", 30),                # per client IP / 15 min
    RATE_LIMIT_LOGIN_PER_ACCOUNT=_int_env("FINORA_LOGIN_ACCOUNT_LIMIT", 10),      # per IP + email / 15 min
    RATE_LIMIT_CHAT_PER_MINUTE=_int_env("FINORA_CHAT_PER_MINUTE", 10),            # per user
    RATE_LIMIT_CHAT_PER_DAY=_int_env("FINORA_CHAT_PER_DAY", 100),                 # per user, UTC day
)
# Only trust X-Forwarded-For when told how many proxies sit in front of the app;
# otherwise a client could spoof its IP and bypass the per-IP limits.
_proxy_hops = _int_env("FINORA_TRUSTED_PROXY_HOPS", 0, minimum=0)
if _proxy_hops:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=_proxy_hops)
allowed_origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, allow_headers=["Content-Type", "Authorization"])

def _days_ago(days):
    return (date.today() - timedelta(days=days)).isoformat()

def _days_ahead(days):
    return (date.today() + timedelta(days=days)).isoformat()

ACCOUNTS = [
    {"id": "CHK-001", "name": "Everyday Checking", "type": "Checking", "balance": 12840.55, "available": 12110.55, "currency": "USD", "lastFour": "4821"},
    {"id": "SAV-002", "name": "Growth Savings", "type": "Savings", "balance": 24500.00, "available": 24500.00, "currency": "USD", "lastFour": "9137"},
]
# Keep in sync with frontend/src/data/mockData.js (same ids, descriptions and amounts).
# Dates are relative to "today" so the demo never looks stale.
_TRANSACTION_ROWS = [
    ("TX-10482", 1, "Salary Deposit", "Income", 3250, "credit", "Completed"),
    ("TX-10481", 2, "FreshMart Groceries", "Groceries", -86.42, "debit", "Completed"),
    ("TX-10480", 3, "Metro Energy", "Utilities", -124.80, "debit", "Completed"),
    ("TX-10479", 4, "CloudStream Internet", "Bills", -59.99, "debit", "Completed"),
    ("TX-10478", 5, "Northside Cafe", "Dining", -18.50, "debit", "Completed"),
    ("TX-10477", 6, "Transfer from Savings", "Transfer", 500, "credit", "Completed"),
    ("TX-10476", 7, "RideNow", "Transport", -24.25, "debit", "Completed"),
    ("TX-10475", 8, "HealthPlus Insurance", "Insurance", -112.00, "debit", "Pending"),
    ("TX-10474", 9, "Green Market", "Groceries", -64.17, "debit", "Completed"),
    ("TX-10473", 10, "Bright Mobile", "Bills", -42.00, "debit", "Completed"),
]
BENEFICIARIES = [
    {"id": "ben-1", "name": "Ava Johnson", "bank": "Northstar Bank", "account": "•••• 7732"},
    {"id": "ben-2", "name": "Liam Chen", "bank": "Finora Bank", "account": "•••• 2914"},
    {"id": "ben-3", "name": "Olivia Smith", "bank": "Union Credit", "account": "•••• 6408"},
]
CARDS = [
    {"id": "card-1", "name": "Finora Platinum", "number": "4821", "expiry": "08/29", "status": "Active", "limit": 8000, "spent": 1840.25},
    {"id": "card-2", "name": "Finora Everyday", "number": "9137", "expiry": "03/28", "status": "Active", "limit": 4000, "spent": 920.40},
]
NOTIFICATIONS = [
    {"id": "n1", "title": "Security check complete", "message": "Your recent sign-in was verified.", "time": "10 min ago", "read": False},
    {"id": "n2", "title": "Bill payment due soon", "message": "Your Metro Energy demo payment is coming up soon.", "time": "2 hrs ago", "read": False},
    {"id": "n3", "title": "Transfer completed", "message": "Your transfer to Ava Johnson was completed.", "time": "Yesterday", "read": True},
]
MAX_BENEFICIARIES = 50

def build_resources():
    """Fresh copy of the fictional demo dataset with dates relative to today."""
    return {
        "accounts": [dict(x) for x in ACCOUNTS],
        "transactions": [
            {"id": tid, "date": _days_ago(days), "description": desc, "category": cat, "amount": amount, "type": kind, "status": status}
            for tid, days, desc, cat, amount, kind, status in _TRANSACTION_ROWS
        ],
        "beneficiaries": [dict(x) for x in BENEFICIARIES],
        "cards": [dict(x) for x in CARDS],
        "notifications": [dict(x) for x in NOTIFICATIONS],
        "bills": [
            {"id": "bill-1", "provider": "Metro Energy", "category": "Electricity", "amount": 124.80, "dueDate": _days_ahead(3), "status": "Pending"},
            {"id": "bill-2", "provider": "CloudStream Internet", "category": "Internet", "amount": 59.99, "dueDate": _days_ahead(7), "status": "Pending"},
            {"id": "bill-3", "provider": "HealthPlus Insurance", "category": "Insurance", "amount": 112.00, "dueDate": _days_ahead(12), "status": "Pending"},
        ],
    }

# Module-level snapshot kept for counting records; seeding always calls build_resources() for fresh dates.
RESOURCES = build_resources()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS resource_ownership (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 resource_type TEXT NOT NULL, resource_id TEXT NOT NULL,
 PRIMARY KEY(user_id, resource_type, resource_id)
);
CREATE TABLE IF NOT EXISTS conversations (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS demo_banking_data (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 resource_type TEXT NOT NULL CHECK(resource_type IN ('accounts','transactions','beneficiaries','cards','notifications','bills')),
 resource_id TEXT NOT NULL,
 data_json TEXT NOT NULL CHECK(json_valid(data_json)),
 PRIMARY KEY(user_id, resource_type, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_demo_banking_user_type ON demo_banking_data(user_id, resource_type);
CREATE TABLE IF NOT EXISTS rate_limits (
 bucket TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL,
 PRIMARY KEY(bucket, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
"""

_DUMMY_PASSWORD_HASH = generate_password_hash("finora-timing-equaliser")

def get_db():
    if "db" not in g:
        path = app.config["DATABASE"]
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        g.db = sqlite3.connect(path, timeout=10)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
        g.db.execute("PRAGMA busy_timeout = 10000")
    return g.db

@app.teardown_appcontext
def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    db.executescript(SCHEMA)
    # Every user owns a private copy of the fictional demo dataset. Backfill any user
    # (e.g. from a database created when only the first user received data) who is
    # missing ownership rows or chatbot data rows. Safe to repeat: inserts are idempotent.
    total = sum(len(records) for records in RESOURCES.values())
    incomplete = db.execute(
        "SELECT u.id FROM users u WHERE "
        "(SELECT COUNT(*) FROM resource_ownership o WHERE o.user_id=u.id) < ? OR "
        "(SELECT COUNT(*) FROM demo_banking_data d WHERE d.user_id=u.id) < ?",
        (total, total),
    ).fetchall()
    for user in incomplete:
        grant_demo_resources(user["id"])
    db.commit()

def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")

def token_digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_session(user_id):
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=app.config["SESSION_HOURS"])).isoformat(timespec="microseconds")
    db = get_db()
    db.execute("INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)", (token_digest(token), user_id, expires, utc_now()))
    db.commit()
    return token, expires

def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer" or not token or len(token) > 256:
            return ok({"error": "Authentication required."}, 401)
        row = get_db().execute("SELECT u.id,u.name,u.email,s.expires_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?", (token_digest(token),)).fetchone()
        if not row or row["expires_at"] <= utc_now():
            if row:
                get_db().execute("DELETE FROM auth_sessions WHERE token_hash=?", (token_digest(token),)); get_db().commit()
            return ok({"error": "Your session is invalid or expired. Please sign in again."}, 401)
        g.current_user = dict(row)
        return view(*args, **kwargs)
    return wrapped

def owns_resource(resource_type, resource_id):
    return get_db().execute("SELECT 1 FROM resource_ownership WHERE user_id=? AND resource_type=? AND resource_id=?", (g.current_user["id"], resource_type, str(resource_id))).fetchone() is not None

def ok(data, status=200): return jsonify(data), status

def client_ip():
    return request.remote_addr or "unknown"

def hit_rate_limit(bucket, limit, window_seconds):
    """Count one hit in a fixed window. Returns 0 if allowed, else seconds until the window resets."""
    now = int(time.time())
    window_start = now - now % window_seconds
    db = get_db()
    row = db.execute(
        "INSERT INTO rate_limits(bucket,window_start,count) VALUES(?,?,1) "
        "ON CONFLICT(bucket,window_start) DO UPDATE SET count=count+1 RETURNING count",
        (bucket, window_start),
    ).fetchone()
    if row["count"] == 1:
        db.execute("DELETE FROM rate_limits WHERE window_start < ?", (now - 2 * 86400,))
    db.commit()
    return max(window_start + window_seconds - now, 1) if row["count"] > limit else 0

def rate_limited(retry_after, message, code="rate_limited"):
    response = jsonify({"error": f"{message} Try again in {retry_after} seconds.", "code": code, "retryAfter": retry_after})
    response.status_code = 429
    response.headers["Retry-After"] = str(retry_after)
    return response

def json_payload():
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else {}

def validate_amount(payload):
    raw_amount = payload.get("amount")
    if isinstance(raw_amount, bool) or raw_amount is None: return None
    try: amount = Decimal(str(raw_amount).strip())
    except (InvalidOperation, ValueError, AttributeError): return None
    if not amount.is_finite() or amount <= 0 or amount > Decimal("1000000"): return None
    try: rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except InvalidOperation: return None
    return float(rounded) if amount == rounded else None

def demo_reference(kind): return f"DEMO-{date.today():%Y%m%d}-{kind}-{uuid4().hex[:8].upper()}"

def seed_demo_banking_data(user_id):
    """Copy only resources already owned by this user into the chatbot data store."""
    db = get_db()
    for resource_type, records in build_resources().items():
        for record in records:
            owned = db.execute(
                "SELECT 1 FROM resource_ownership WHERE user_id=? AND resource_type=? AND resource_id=?",
                (user_id, resource_type, record["id"]),
            ).fetchone()
            if owned:
                db.execute(
                    "INSERT OR IGNORE INTO demo_banking_data(user_id,resource_type,resource_id,data_json) VALUES(?,?,?,?)",
                    (user_id, resource_type, record["id"], json.dumps(record, separators=(",", ":"))),
                )


def grant_demo_resources(user_id):
    """Give one user ownership of, and a private stored copy of, the fictional demo dataset."""
    db = get_db()
    for resource_type, records in build_resources().items():
        db.executemany(
            "INSERT OR IGNORE INTO resource_ownership(user_id,resource_type,resource_id) VALUES(?,?,?)",
            [(user_id, resource_type, item["id"]) for item in records],
        )
    seed_demo_banking_data(user_id)


def get_user_demo_context(user_id, question):
    """Build bounded LLM context exclusively from the authenticated user's SQLite rows."""
    text = question.lower()
    all_categories = any(word in text for word in ("everything", "all my", "summarize my finances", "financial summary"))
    categories = set()
    if all_categories:
        categories = {"accounts", "transactions", "beneficiaries", "cards", "bills"}
    else:
        if any(word in text for word in ("bill", "payment due", "upcoming payment", "pending payment")):
            categories.add("bills")
        if any(word in text for word in ("beneficiar", "saved recipient", "recipient")):
            categories.add("beneficiaries")
        if any(word in text for word in ("card", "credit limit", "freeze")):
            categories.add("cards")
        if any(word in text for word in ("transaction", "spend", "spent", "spending", "purchase", "debit", "credit history")):
            categories.add("transactions")
        if any(word in text for word in ("balance", "account", "available funds", "available money")):
            categories.add("accounts")

    context = {
        "demo_only": True,
        "today": date.today().isoformat(),
        "data_scope": "records belonging only to the authenticated user",
        "accounts": [], "recent_transactions": [], "beneficiaries": [], "cards": [], "bills": [],
    }
    if not categories:
        return context

    db = get_db()
    placeholders = ",".join("?" for _ in categories)
    rows = db.execute(
        f"SELECT resource_type,resource_id,data_json FROM demo_banking_data WHERE user_id=? AND resource_type IN ({placeholders}) ORDER BY resource_type,resource_id",
        (user_id, *sorted(categories)),
    ).fetchall()
    records = {category: [] for category in categories}
    for row in rows:
        # The data is stored as JSON and decoded as data, never interpreted as SQL.
        records[row["resource_type"]].append(json.loads(row["data_json"]))

    if "accounts" in categories:
        context["accounts"] = [{k: a.get(k) for k in ("name", "type", "balance", "available", "currency")} for a in records["accounts"]]
        # Precomputed so the model quotes totals instead of adding floating-point numbers itself.
        context["account_totals"] = {
            "account_count": len(context["accounts"]),
            "total_balance": round(sum(float(a.get("balance") or 0) for a in context["accounts"]), 2),
            "total_available": round(sum(float(a.get("available") or 0) for a in context["accounts"]), 2),
        }
    if "transactions" in categories:
        transactions = sorted(records["transactions"], key=lambda item: (item.get("date", ""), item.get("id", "")), reverse=True)
        context["recent_transactions"] = [{k: t.get(k) for k in ("date", "description", "category", "amount", "type", "status")} for t in transactions[:10]]
        context["all_time_debit_total"] = round(sum(abs(float(t.get("amount", 0))) for t in transactions if t.get("type") == "debit"), 2)
        context["transaction_records_total"] = len(transactions)
        month = date.today().strftime("%Y-%m")
        month_rows = [t for t in transactions if str(t.get("date", "")).startswith(month)]
        debit_total = round(sum(abs(float(t.get("amount", 0))) for t in month_rows if t.get("type") == "debit"), 2)
        context["monthly_spending"] = {"period": month, "debit_total": debit_total, "transaction_count": len(month_rows), "has_records": bool(month_rows)}
    if "beneficiaries" in categories:
        context["beneficiaries"] = [{k: b.get(k) for k in ("name", "bank", "account")} for b in records["beneficiaries"]]
    if "cards" in categories:
        context["cards"] = [{k: c.get(k) for k in ("name", "status", "limit", "spent")} for c in records["cards"]]
    if "bills" in categories:
        context["bills"] = [{k: b.get(k) for k in ("provider", "category", "amount", "dueDate", "status")} for b in records["bills"]]
    return context

@app.get("/api/health")
def health():
    try:
        get_db().execute("SELECT 1").fetchone()
    except sqlite3.DatabaseError:
        app.logger.exception("Health check could not access the SQLite database.")
        return ok({"status": "unavailable", "demo": True}, 503)
    return ok({"status": "ok", "demo": True, "database": "ok", "llm": llm_status()})

@app.post("/api/auth/register")
def register():
    wait = hit_rate_limit(f"register:ip:{client_ip()}", app.config["RATE_LIMIT_REGISTER_PER_HOUR"], 3600)
    if wait: return rate_limited(wait, "Too many sign-up attempts from this network.")
    payload = json_payload(); name = payload.get("name"); email = payload.get("email"); password = payload.get("password")
    if not all(isinstance(x, str) for x in (name, email, password)):
        return ok({"error": "Name, email and password are required."}, 400)
    name, email, password = name.strip(), email.strip().lower(), password
    if not name or len(name) > 80 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(email) > 254:
        return ok({"error": "Enter a valid name and email address."}, 400)
    if len(password) < 8 or len(password) > 128:
        return ok({"error": "Password must contain 8–128 characters."}, 400)
    db = get_db()
    try:
        cursor = db.execute("INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)", (name, email, generate_password_hash(password), utc_now()))
        user_id = cursor.lastrowid
        grant_demo_resources(user_id)
        token, expires = create_session(user_id)
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback(); return ok({"error": "An account with this email already exists."}, 409)
    return ok({"user": {"id": user_id, "name": name, "email": email}, "token": token, "expiresAt": expires}, 201)

@app.post("/api/auth/login")
def login():
    payload = json_payload(); email = payload.get("email"); password = payload.get("password")
    ip = client_ip()
    wait = hit_rate_limit(f"login:ip:{ip}", app.config["RATE_LIMIT_LOGIN_PER_IP"], 900)
    if not wait and isinstance(email, str) and email.strip():
        email_key = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:32]
        wait = hit_rate_limit(f"login:acct:{ip}:{email_key}", app.config["RATE_LIMIT_LOGIN_PER_ACCOUNT"], 900)
    if wait: return rate_limited(wait, "Too many sign-in attempts.")
    if not isinstance(email, str) or not isinstance(password, str) or not email.strip() or not password:
        return ok({"error": "Email and password are required."}, 400)
    user = get_db().execute("SELECT id,name,email,password_hash FROM users WHERE email=? COLLATE NOCASE", (email.strip(),)).fetchone()
    if not user:
        check_password_hash(_DUMMY_PASSWORD_HASH, password)  # constant-ish work; result intentionally ignored
        return ok({"error": "Invalid email or password."}, 401)
    if not check_password_hash(user["password_hash"], password):
        return ok({"error": "Invalid email or password."}, 401)
    token, expires = create_session(user["id"])
    return ok({"user": {"id": user["id"], "name": user["name"], "email": user["email"]}, "token": token, "expiresAt": expires})

@app.post("/api/auth/logout")
@require_auth
def logout():
    token = request.headers.get("Authorization", "").split(" ", 1)[1]
    get_db().execute("DELETE FROM auth_sessions WHERE token_hash=?", (token_digest(token),)); get_db().commit()
    return ok({"status": "logged_out"})

@app.get("/api/auth/me")
@require_auth
def me(): return ok({"user": {k: g.current_user[k] for k in ("id", "name", "email")}})

def owned_records(resource_type):
    """The authenticated user's own records of one type, in insertion order."""
    rows = get_db().execute(
        "SELECT d.data_json FROM demo_banking_data d "
        "JOIN resource_ownership o ON o.user_id=d.user_id AND o.resource_type=d.resource_type AND o.resource_id=d.resource_id "
        "WHERE d.user_id=? AND d.resource_type=? ORDER BY d.rowid",
        (g.current_user["id"], resource_type),
    ).fetchall()
    return [json.loads(row["data_json"]) for row in rows]

@app.get("/api/accounts")
@require_auth
def accounts(): return ok(owned_records("accounts"))
@app.get("/api/transactions")
@require_auth
def transactions(): return ok(owned_records("transactions"))
@app.get("/api/beneficiaries")
@require_auth
def beneficiaries(): return ok(owned_records("beneficiaries"))
@app.get("/api/cards")
@require_auth
def cards(): return ok(owned_records("cards"))
@app.get("/api/notifications")
@require_auth
def notifications(): return ok(owned_records("notifications"))

def validate_beneficiary(payload):
    """Return (record_fields, error). Only a masked last-four suffix is ever accepted."""
    name, bank, last_four = payload.get("name"), payload.get("bank"), payload.get("lastFour")
    if not all(isinstance(x, str) for x in (name, bank, last_four)):
        return None, "Name, bank and the last four digits are required."
    name, bank, last_four = name.strip(), bank.strip(), last_four.strip()
    if not 2 <= len(name) <= 80: return None, "Enter a name between 2 and 80 characters."
    if not 2 <= len(bank) <= 80: return None, "Enter a bank name between 2 and 80 characters."
    if not re.fullmatch(r"[0-9]{4}", last_four): return None, "Enter only the last four digits of the demo account."
    return {"name": name, "bank": bank, "account": f"•••• {last_four}"}, None

@app.post("/api/beneficiaries")
@require_auth
def create_beneficiary():
    fields, error = validate_beneficiary(json_payload())
    if error: return ok({"error": error}, 400)
    db = get_db(); uid = g.current_user["id"]
    count = db.execute("SELECT COUNT(*) FROM resource_ownership WHERE user_id=? AND resource_type='beneficiaries'", (uid,)).fetchone()[0]
    if count >= MAX_BENEFICIARIES:
        return ok({"error": f"You can save up to {MAX_BENEFICIARIES} demo beneficiaries."}, 400)
    record = {"id": f"ben-{uuid4().hex[:8]}", **fields}
    db.execute("INSERT INTO resource_ownership(user_id,resource_type,resource_id) VALUES(?,?,?)", (uid, "beneficiaries", record["id"]))
    db.execute("INSERT INTO demo_banking_data(user_id,resource_type,resource_id,data_json) VALUES(?,?,?,?)", (uid, "beneficiaries", record["id"], json.dumps(record, separators=(",", ":"))))
    db.commit()
    return ok(record, 201)

@app.put("/api/beneficiaries/<beneficiary_id>")
@require_auth
def update_beneficiary(beneficiary_id):
    fields, error = validate_beneficiary(json_payload())
    if error: return ok({"error": error}, 400)
    if not owns_resource("beneficiaries", beneficiary_id): return ok({"error": "Beneficiary not found."}, 404)
    record = {"id": beneficiary_id, **fields}
    db = get_db()
    cursor = db.execute("UPDATE demo_banking_data SET data_json=? WHERE user_id=? AND resource_type='beneficiaries' AND resource_id=?", (json.dumps(record, separators=(",", ":")), g.current_user["id"], beneficiary_id))
    db.commit()
    if cursor.rowcount == 0: return ok({"error": "Beneficiary not found."}, 404)
    return ok(record)

@app.post("/api/transfers")
@require_auth
def transfer():
    payload = json_payload(); amount = validate_amount(payload)
    if amount is None: return ok({"error": "Enter an amount greater than 0 and no more than 1,000,000."}, 400)
    source_account, beneficiary_id, note = payload.get("sourceAccount"), payload.get("beneficiaryId"), payload.get("note", "")
    if not isinstance(source_account, str) or not isinstance(beneficiary_id, str) or not source_account.strip() or not beneficiary_id.strip(): return ok({"error": "Source account and beneficiary are required."}, 400)
    if not isinstance(note, str) or len(note) > 80: return ok({"error": "Transfer note must be text with 80 characters or fewer."}, 400)
    if not owns_resource("accounts", source_account): return ok({"error": "Source account not found."}, 404)
    if not owns_resource("beneficiaries", beneficiary_id): return ok({"error": "Beneficiary not found."}, 404)
    return ok({"status": "simulated", "amount": amount, "reference": demo_reference("TRANSFER"), "message": "Demo transfer validated; no money moved."}, 201)

@app.post("/api/bill-payments")
@require_auth
def bill_payment():
    payload = json_payload(); amount = validate_amount(payload); provider = payload.get("provider", ""); customer = payload.get("customer", "")
    if not isinstance(provider, str) or not isinstance(customer, str): return ok({"error": "Provider and customer number must be text."}, 400)
    provider, customer = provider.strip(), customer.strip()
    if amount is None: return ok({"error": "Enter an amount greater than 0 and no more than 1,000,000."}, 400)
    if not provider or not customer: return ok({"error": "Provider and customer number are required."}, 400)
    if len(provider) > 100 or len(customer) > 100: return ok({"error": "Provider and customer number must be 100 characters or fewer."}, 400)
    return ok({"status": "simulated", "amount": amount, "reference": demo_reference("BILL"), "message": "Demo bill payment validated; no payment was made."}, 201)

@app.get("/api/conversations")
@require_auth
def list_conversations():
    rows = get_db().execute("SELECT id,title,created_at AS createdAt,updated_at AS updatedAt FROM conversations WHERE user_id=? ORDER BY updated_at DESC", (g.current_user["id"],)).fetchall()
    return ok([dict(r) for r in rows])

@app.post("/api/conversations")
@require_auth
def create_conversation():
    title = json_payload().get("title", "New conversation")
    if not isinstance(title, str): return ok({"error": "Conversation title must be text."}, 400)
    title = title.strip()[:100] or "New conversation"; now = utc_now(); cid = str(uuid4())
    get_db().execute("INSERT INTO conversations(id,user_id,title,created_at,updated_at) VALUES(?,?,?,?,?)", (cid, g.current_user["id"], title, now, now)); get_db().commit()
    return ok({"id": cid, "title": title, "createdAt": now, "updatedAt": now}, 201)

@app.get("/api/conversations/<conversation_id>/messages")
@require_auth
def get_messages(conversation_id):
    owner = get_db().execute("SELECT 1 FROM conversations WHERE id=? AND user_id=?", (conversation_id, g.current_user["id"])).fetchone()
    if not owner: return ok({"error": "Conversation not found."}, 404)
    rows = get_db().execute("SELECT id,role,content,created_at AS createdAt FROM messages WHERE conversation_id=? ORDER BY created_at,id", (conversation_id,)).fetchall()
    return ok([dict(r) for r in rows])

@app.delete("/api/conversations/<conversation_id>")
@require_auth
def delete_conversation(conversation_id):
    cursor = get_db().execute("DELETE FROM conversations WHERE id=? AND user_id=?", (conversation_id, g.current_user["id"]))
    get_db().commit()
    if cursor.rowcount == 0: return ok({"error": "Conversation not found."}, 404)
    return ok({"status": "deleted"})

@app.post("/api/chat")
@require_auth
def chat():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict): return ok({"error": "Send a valid JSON object."}, 400)
    message = payload.get("message", "")
    if not isinstance(message, str): return ok({"error": "Message must be text."}, 400)
    message = message.strip()
    if not message: return ok({"error": "Message is required."}, 400)
    if len(message) > 500: return ok({"error": "Message must be 500 characters or fewer."}, 400)
    if "history" in payload:
        return ok({"error": "Conversation history is loaded securely from the server."}, 400)
    # Quota is charged before any provider call so failed LLM requests still count toward cost control.
    uid = g.current_user["id"]
    wait = hit_rate_limit(f"chat:min:{uid}", app.config["RATE_LIMIT_CHAT_PER_MINUTE"], 60)
    if wait: return rate_limited(wait, "You are sending messages too quickly.", "chat_rate_limited")
    wait = hit_rate_limit(f"chat:day:{uid}", app.config["RATE_LIMIT_CHAT_PER_DAY"], 86400)
    if wait: return rate_limited(wait, "Daily assistant message limit reached.", "chat_quota_exceeded")
    conversation_id = payload.get("conversationId")
    if not isinstance(conversation_id, str) or not get_db().execute("SELECT 1 FROM conversations WHERE id=? AND user_id=?", (conversation_id, g.current_user["id"])).fetchone():
        return ok({"error": "A valid conversation belonging to this user is required."}, 404)
    raw_history = get_db().execute("SELECT role,content FROM messages WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 8", (conversation_id,)).fetchall()
    history = [{"role": r["role"], "content": r["content"][:500]} for r in reversed(raw_history)]
    try:
        # Identity comes from the verified server-side session, never from request JSON.
        demo_context = get_user_demo_context(g.current_user["id"], message)
    except (sqlite3.DatabaseError, ValueError, TypeError):
        get_db().rollback()
        app.logger.exception("Unable to retrieve authorized demo banking context.")
        return ok({"error": "Banking demo information is temporarily unavailable. Please try again.", "code": "banking_data_unavailable"}, 503)
    db = get_db(); now = utc_now()
    db.execute("INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)", (str(uuid4()), conversation_id, "user", message, now))
    db.execute("UPDATE conversations SET title=CASE WHEN title='New conversation' THEN ? ELSE title END, updated_at=? WHERE id=?", (message[:60], now, conversation_id)); db.commit()
    try: reply = generate_llm_reply(message, history, demo_context)
    except LLMConfigurationError: return ok({"error": "The AI assistant is not configured. Add OPENAI_API_KEY to backend/.env and restart Flask.", "code": "llm_not_configured"}, 503)
    except LLMAuthError: return ok({"error": "The AI provider rejected the API key. Check OPENAI_API_KEY in backend/.env (and OPENAI_BASE_URL if you use a non-OpenAI provider), then restart Flask.", "code": "llm_auth_failed"}, 502)
    except LLMQuotaError: return ok({"error": "The AI provider account has no remaining credit or quota. Check billing on the provider dashboard.", "code": "llm_quota_exhausted"}, 429)
    except LLMRateLimitError: return ok({"error": "The AI service is temporarily rate-limited. Please wait a moment and try again.", "code": "llm_rate_limited"}, 429)
    except LLMTimeoutError: return ok({"error": "The AI assistant took too long to respond. Please try again.", "code": "llm_timeout"}, 504)
    except LLMProviderError:
        app.logger.warning("LLM provider request failed; details intentionally omitted from client response.")
        return ok({"error": "The AI assistant is temporarily unavailable. Check the provider configuration and try again.", "code": "llm_unavailable"}, 502)
    test_provider = is_test_provider(); now = utc_now()
    db.execute("INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)", (str(uuid4()), conversation_id, "assistant", reply, now))
    db.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, conversation_id)); db.commit()
    return ok({"reply": reply, "provider": "test" if test_provider else "openai", "aiGenerated": not test_provider, "testProvider": test_provider, "simulated": True})

@app.errorhandler(404)
def not_found(_error): return ok({"error": "API endpoint not found. Check the method and URL."}, 404)
@app.errorhandler(405)
def method_not_allowed(_error): return ok({"error": "Method not allowed for this API endpoint."}, 405)
@app.errorhandler(413)
def payload_too_large(_error): return ok({"error": "Request body is too large for this demo API."}, 413)
@app.errorhandler(500)
def internal_error(_error):
    app.logger.exception("Unhandled demo API error")
    return ok({"error": "Unexpected server error. Please try again."}, 500)

with app.app_context():
    init_db()

if __name__ == "__main__":
    app.run(host=os.getenv("FLASK_HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")), debug=False)
