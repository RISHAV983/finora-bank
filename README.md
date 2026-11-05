# Finora Bank — React + Flask Portfolio Demo

Finora is a fictional banking workflow demo designed to demonstrate junior/fresher frontend engineering skills: component-based React, routing, responsive layouts, REST API integration, form validation, accessible interaction patterns, error handling, tests, and a small Python API.

> **Safety notice:** Finora is not a real bank. It now uses SQLite-backed demo accounts, bearer-session authentication, backend ownership checks, and persistent chatbot conversations. Banking records and all financial actions remain fictional; transfers and bill payments are simulations only. Never enter real financial credentials or information.

## Project highlights

- React 18, JavaScript ES modules, Vite and React Router
- Responsive dashboard, accounts, transactions, transfers, bills, beneficiaries, cards, notifications, profile, settings and assistant screens
- React app state and persisted display preferences; bearer authentication token stored locally
- Centralized Fetch API client with timeout, structured errors and readable connection-failure guidance
- Flask JSON endpoints with SQLite persistence, secure password hashing, expiring bearer sessions, ownership-scoped resource access, input validation, bounded request sizes, configurable CORS origins, and SQLite-backed rate limiting with a per-user daily chat quota
- Genuine OpenAI LLM chatbot through the Flask backend when `OPENAI_API_KEY` is configured; conversations and messages persist in SQLite, history is loaded server-side with bounded context, fictional demo context, safe provider errors, and no rule-based fallback presented as AI
- Functional beneficiary add/edit flow that stores only masked demo account suffixes; global transaction search; settings that control notifications, compact rows, and review confirmations
- React error boundary so an unexpected render error shows a recovery screen instead of an unexplained blank page
- Frontend tests, backend unit tests, ESLint, Prettier and GitHub Actions CI

## Architecture

```text
bank-ui-app/
├── .github/workflows/ci.yml
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── smoke_test.py          # live API smoke checks (requires running Flask)
│   └── test_app.py            # isolated Flask test-client suite
├── frontend/
│   ├── src/
│   │   ├── components/       # layout, reusable UI, chatbot, error boundary
│   │   ├── context/          # demo app/session state
│   │   ├── data/             # fictional seed data
│   │   ├── hooks/            # reusable hooks
│   │   ├── pages/            # route-level screens
│   │   ├── services/         # API client and tests
│   │   ├── test/             # test setup
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── tests/e2e/             # Playwright live API, workflow and responsive tests
│   ├── scripts/               # cross-platform test helpers
│   ├── playwright.config.js
│   ├── eslint.config.js
│   ├── package.json
│   ├── vercel.json            # SPA route fallback for Vercel
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Requirements

- Node.js 20 LTS recommended (Node 18+ may work with compatible package versions)
- npm
- Python 3.10+

## Run locally on Windows (VS Code)

Open the `bank-ui-app` folder in VS Code. Use two terminals and keep both open while developing.

### Terminal 1 — frontend

```powershell
cd frontend
npm ci
npm start
```

Open the Vite URL printed by the terminal, normally `http://localhost:5173`.

### Terminal 2 — backend

From the project root, open **Terminal → New Terminal**:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

If PowerShell blocks environment activation, use Command Prompt in the terminal and run `.venv\Scripts\activate.bat`, or invoke `.venv\Scripts\python.exe app.py` after installing requirements.

Check the backend in your browser at `http://127.0.0.1:5000/api/health`. Expected JSON: `{"demo":true,"status":"ok"}`. If this URL does not respond, the chatbot cannot reach Flask yet.

### macOS/Linux backend activation

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Configuration

The frontend defaults to `http://127.0.0.1:5000/api`. To override it, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL` to the base API URL (without a trailing slash). Restart Vite after changing environment variables.

Backend CORS defaults to `http://localhost:5173,http://127.0.0.1:5173`. Configure `CORS_ORIGINS` as a comma-separated list of exact allowed frontend origins if needed. Do not use wildcard origins for a deployed app with credentials.

## Enabling the AI assistant (fixes "The AI assistant is not configured")

1. Copy `backend/.env.example` to `backend/.env` (the file must be named exactly `.env`, saved as plain UTF-8).
2. Create a key at <https://platform.openai.com/api-keys> (the account needs billing credit) and paste it after `OPENAI_API_KEY=` with no quotes or spaces.
3. **Restart Flask** (`Ctrl+C`, then `python app.py`). The `.env` file is only read at startup.
4. Verify: open `http://127.0.0.1:5000/api/health`; `"llm": {"configured": true}` means the key was found. For a real round-trip, run `RUN_LIVE_LLM_TEST=1 python smoke_llm.py` (PowerShell: `$env:RUN_LIVE_LLM_TEST=1; python smoke_llm.py`).

Any OpenAI-compatible provider also works by setting `OPENAI_BASE_URL` and `OPENAI_MODEL` (for example Groq, Gemini's OpenAI endpoint, or a local Ollama server). Provider failures are logged in the Flask terminal with the reason (invalid key, no credit, wrong model name); the browser shows a matching message instead of a generic one.

## Authentication and database

- SQLite is initialized automatically when Flask starts. The default file is `backend/finora.sqlite3`; override it with `FINORA_DATABASE_PATH`.
- The schema contains `users`, `auth_sessions`, `resource_ownership`, `demo_banking_data`, `conversations`, `messages`, and `rate_limits`. Foreign-key enforcement is enabled on each connection; conversation deletion cascades to its messages.
- Register through the Finora login screen. Passwords are hashed with Werkzeug's password-hashing utilities; plaintext passwords are never stored. Login returns a random bearer token whose SHA-256 digest is stored server-side. Sessions expire after `FINORA_SESSION_HOURS` (default 12 hours); logout revokes the session.
- Protected API calls require `Authorization: Bearer <token>`. The backend derives the user identity from the session and checks resource ownership; it does not trust a client-supplied user ID.
- Every registered user receives their own private copy of the fictional demo dataset (accounts, transactions, beneficiaries, cards, notifications, bills). Ownership rows and the chatbot's `demo_banking_data` rows are keyed by `user_id`, so one user's records are never read in another user's session. On startup the backend backfills any existing user who is missing these rows. The frontend still renders its own fixture data for accounts, transactions, cards and notifications (changes there are client-side only, and are reset whenever the signed-in user changes), which matches what the backend seeds; the two copies must be kept in sync by hand (`frontend/src/data/mockData.js` and `build_resources()` in `backend/app.py`). Seed dates are relative to today. Beneficiaries are the exception: they are loaded from and saved to the API, so a newly added recipient is a valid transfer target.
- Chat conversations and messages are stored in SQLite and scoped to the authenticated owner. The LLM receives bounded history retrieved from that conversation on the server, not client-supplied history.
- Configure `FINORA_DATABASE_PATH` and `FINORA_SESSION_HOURS` in `backend/.env` if needed. The defaults work locally. The database file, WAL files and environment secrets are excluded from Git.

The application has no pre-created demo credentials. Create an account from the login screen. Use a unique email and a password of at least 8 characters; never reuse a personal password.

## Rate limiting and chat quota

Limits use fixed windows stored in the SQLite database, so they are shared by every gunicorn worker (in-memory counters would not be). Exceeding a limit returns HTTP 429 with a `Retry-After` header and a JSON body containing `code` and `retryAfter`.

| Scope | Default | Environment variable |
| --- | --- | --- |
| Registrations per client IP per hour | 5 | `FINORA_REGISTER_LIMIT` |
| Login attempts per client IP per 15 min | 30 | `FINORA_LOGIN_IP_LIMIT` |
| Login attempts per IP + email per 15 min | 10 | `FINORA_LOGIN_ACCOUNT_LIMIT` |
| Assistant messages per user per minute | 10 | `FINORA_CHAT_PER_MINUTE` |
| Assistant messages per user per UTC day | 100 | `FINORA_CHAT_PER_DAY` |

- The chat quota is charged before the OpenAI request, so failed provider calls still count; this caps spend. Requests rejected for validation do not count.
- Behind a reverse proxy, set `FINORA_TRUSTED_PROXY_HOPS` to the number of proxies in front of Flask (`render.yaml` sets 1). Leave it at 0 when running locally. Setting it higher than the real number of proxies lets clients spoof their IP and bypass per-IP limits, so verify it on your host.
- Limits are per-IP/per-user fixed windows and are a baseline, not a substitute for a WAF or CAPTCHA on a heavily exposed deployment.
- Playwright starts the backend with raised limits because the suite registers many users from one IP.

## Verification status

Run in this change set and passing: backend unit tests (60), frontend unit tests (25), ESLint (0 errors, 1 fast-refresh warning), Prettier check, production build, and the live API smoke test against a running Flask server (also exercised manually: chat reply with the test adapter, adding a beneficiary and transferring to it). **Not run in this change set:** the Playwright browser/responsive suite (Chromium could not be downloaded in the sandbox) and the live OpenAI smoke test. Run `npm run verify:all` locally to execute the browser suite.

`npm audit` still reports findings. The production-dependency finding is a moderate issue in `react-router`/`react-router-dom` whose only fix is a major upgrade to v7. The remaining findings (`vitest`, `playwright`, `eslint` and their transitive packages) are development-time tooling that is not shipped to users; fixing them requires major or minor tooling upgrades that should be validated with the browser suite.

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Readiness check |
| POST | `/api/auth/register` | Create a user and session |
| POST | `/api/auth/login` | Authenticate and create a session |
| POST | `/api/auth/logout` | Revoke current session |
| GET | `/api/auth/me` | Return authenticated user |
| GET | `/api/accounts` | Fictional accounts (authenticated, owner-scoped) |
| GET | `/api/transactions` | Fictional transactions (authenticated, owner-scoped) |
| GET | `/api/beneficiaries` | Fictional beneficiaries (authenticated, owner-scoped) |
| POST | `/api/beneficiaries` | Add a demo beneficiary (`name`, `bank`, `lastFour`; only a masked suffix is stored; max 50 per user) |
| PUT | `/api/beneficiaries/:id` | Edit an owned demo beneficiary |
| GET | `/api/cards` | Fictional cards (authenticated, owner-scoped) |
| GET | `/api/notifications` | Fictional notifications (authenticated, owner-scoped) |
| POST | `/api/transfers` | Validates a simulated transfer request; never moves money |
| POST | `/api/bill-payments` | Validates a simulated bill payment; never pays a bill |
| GET/POST | `/api/conversations` | List or create the current user's conversations |
| GET | `/api/conversations/:id/messages` | Retrieve messages for an owned conversation |
| DELETE | `/api/conversations/:id` | Delete an owned conversation and its messages |
| POST | `/api/chat` | Persist user/assistant messages and generate an OpenAI answer when configured |

All protected banking and chatbot endpoints require a valid bearer session. All POST banking responses explicitly indicate simulated behavior and return a demo reference. Monetary inputs must be positive, finite, within the configured maximum, and representable to two decimal places. The demo backend does not persist server-side transaction changes. The browser updates the local demo balance/activity after a successful validation response; banking screen fixture state remains client-side and resets on refresh. Chat history, user accounts and authentication sessions are persisted server-side in SQLite.

## Quality checks and real browser verification

The project separates isolated backend unit tests from tests that require a running app. The Playwright end-to-end suite starts Flask and Vite, uses the actual React UI and live Flask API, and captures screenshots/traces on failure. It includes a five-size responsive matrix (320×700, 375×812, 768×1024, 1366×768, and 1920×1080).

### Prerequisites

- Node.js 20 or 22 and npm.
- Python 3.10 or newer.
- Chromium installed by Playwright for browser tests.

### Install dependencies on Windows (PowerShell)

From the `bank-ui-app` project root:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cd ..\frontend
npm ci
npx playwright install chromium
```

If PowerShell blocks virtual-environment activation, use Command Prompt with `.venv\Scripts\activate.bat`, or run the virtual environment's Python executable directly. The Playwright configuration automatically uses `backend/.venv` when it exists.

### Run backend unit tests

From the `frontend` directory:

```powershell
npm run test:backend
```

This invokes Python's unittest discovery against `backend/test_app.py` using the backend virtual environment when available. To run it directly from the project root with an activated Python environment:

```powershell
python -m unittest discover -s backend -p "test*.py" -v
```

### Run live API smoke checks

Start Flask in a separate terminal from `backend` (`python app.py`), then from `frontend` run:

```powershell
npm run test:api-smoke
```

The script checks the live health, accounts, transactions, beneficiaries, cards, notifications, chat, simulated transfer and bill-payment endpoints, including invalid transfer input. It exits non-zero on connection failure or failed assertions. To target a different server, set `API_BASE_URL` to the API base URL, for example `http://127.0.0.1:5000/api`.

### Run frontend quality checks

From `frontend`:

```powershell
npm run lint
npm test
npm run build
```

### Run live browser and responsive tests

From `frontend`:

```powershell
npx playwright install chromium
npm run test:e2e
npm run test:e2e:responsive
```

The Playwright configuration starts Flask with the explicit deterministic test adapter and starts Vite for the test run. Stop any manually running Flask service on port 5000 before running Playwright so the test adapter is applied. The suite uses Chromium and tests real navigation, dashboard rendering, transaction search, transfer validation and simulated confirmation, beneficiary creation, card freeze controls, chatbot responses, unknown routes, live API behavior, and layout at the five documented viewport sizes. A running backend is required; missing services fail the tests rather than being treated as success.

Reports and diagnostics are written under `frontend/playwright-report/` and `frontend/test-results/`. Screenshots, videos and traces are collected for failed browser tests when available.

### Run the combined verification

From `frontend`:

```powershell
npm run verify:all
```

This runs backend unit tests, frontend lint, frontend unit tests, the production build, then Playwright end-to-end and responsive checks (the Playwright suite includes live API smoke assertions). The separate `npm run test:api-smoke` command is useful for checking an already running Flask server directly.

### Troubleshooting

- **Connection refused / API tests fail:** verify Flask starts at `http://127.0.0.1:5000/api/health` and Vite at `http://127.0.0.1:5173`.
- **Port already in use:** stop the old dev server or change the configured ports and update Playwright's `baseURL`, health URL and API base URL consistently.
- **Playwright says browser executable is missing:** run `npx playwright install chromium` from `frontend`.
- **Flask import errors:** activate `backend/.venv` and run `python -m pip install -r backend/requirements.txt`.
- **Browser test reports horizontal overflow:** use the failing viewport screenshot and trace to identify the specific element; do not weaken the assertion without understanding the cause.
- **CORS errors in a browser:** check `CORS_ORIGINS` in the backend environment and include the exact Vite origin. The tests use local defaults.
- **Dependency install errors:** check Node/Python versions and network/package-registry access, then rerun installation before treating tests as executed.

The GitHub Actions workflow installs dependencies with `npm ci` (lockfile committed), runs backend tests (including mocked LLM integration tests), frontend format check, lint, unit tests and build, installs Chromium, then runs the API and browser suite with the explicitly labelled deterministic test adapter. It does not require a paid LLM API key. A separate optional live LLM smoke test verifies real provider inference when explicitly enabled. A passing run is evidence for the tested paths only, not proof that every possible state is bug-free or that the demo is production banking software.


## SQLite-backed chatbot data

The chatbot now reads its banking context from the authenticated user's `demo_banking_data` rows in SQLite. The table stores the existing fictional account, transaction, beneficiary, card, notification, and bill fixtures as JSON records keyed by user, resource type, and resource ID. It is an additive table; the existing authentication, ownership, conversation, and message tables remain in place.

- Every user receives their own copy of the original demo resource set when they register; startup also backfills existing users from older databases. Records are keyed by `user_id`, so users never see each other's data.
- On startup, the backend backfills ownership and this table for any user who is missing rows, so an existing database can be upgraded without resetting users or conversations.
- The chatbot derives the user ID from the verified bearer session. It does not accept a frontend user ID as authority.
- Only the category relevant to the user's question is retrieved and passed to the LLM. Account last-four values and card numbers are not included in the model context. Transaction context is bounded to the ten most recent rows; current-month spending is calculated from that user's SQLite transaction rows.
- Bill records are fictional upcoming demo records seeded into SQLite. They do not represent real invoices or completed payments.
- The OpenAI provider and configured model are unchanged. Database fields are treated as untrusted data, and the LLM is instructed not to follow instructions embedded in those fields.

## Production deployment

Deployment configuration is included, but a live deployment must be created in hosting accounts you control. Do not mark the project as deployed until you have completed the provider steps below and verified the resulting URLs. The repository does not contain hosting credentials, an OpenAI key, or a Vercel/Render account connection.

### Backend — Render with persistent SQLite disk

1. Push the project to a GitHub repository you control.
2. In Render, create a **Blueprint** and select the repository. Render reads the root `render.yaml` file.
3. The blueprint provisions a Python Flask web service and a 1 GB persistent disk mounted at `/var/data`. The database path is configured as `/var/data/finora.sqlite3`; do not change it to an ephemeral application directory.
4. In the Render service environment, set `OPENAI_API_KEY` to your own secret key. Keep it in Render's secret environment settings, never in Git.
5. After creating the frontend deployment, set `CORS_ORIGINS` to the exact HTTPS origin of that Vercel site (for example, `https://your-finora-site.vercel.app`, without a path or trailing slash). If you use a custom domain, include that exact origin too, comma-separated.
6. Deploy the service and wait for `https://<your-render-service>.onrender.com/api/health` to return HTTP 200 with `status: ok` and `database: ok`.
7. Confirm the service plan supports persistent disks. The supplied blueprint uses a paid Starter web service because SQLite data must survive service restarts and redeployments. Do not remove the disk or use ephemeral storage.

Required backend environment variables:

| Variable | Value |
|---|---|
| `FLASK_HOST` | `0.0.0.0` |
| `FINORA_DATABASE_PATH` | `/var/data/finora.sqlite3` |
| `FINORA_SESSION_HOURS` | `12` (or your chosen session lifetime) |
| `OPENAI_MODEL` | `gpt-4o-mini` (existing default) |
| `OPENAI_API_KEY` | Secret value configured in Render |
| `CORS_ORIGINS` | Exact production frontend origin(s), comma-separated |

Render supplies `PORT` automatically. `gunicorn` is included in `backend/requirements.txt` and is used as the production WSGI server.

### Frontend — Vercel

1. In Vercel, import the same GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Use `npm run build` as the build command and `dist` as the output directory. Vercel detects Vite automatically; `frontend/vercel.json` supplies the SPA fallback so refreshing a React route serves `index.html`.
4. Add the production environment variable `VITE_API_BASE_URL` with the backend base URL, including `/api`, for example `https://<your-render-service>.onrender.com/api`.
5. Deploy and verify the frontend URL. Vite environment variables are embedded at build time, so redeploy after changing `VITE_API_BASE_URL`.
6. Copy the final Vercel HTTPS origin into the Render `CORS_ORIGINS` setting and redeploy/restart the backend.

### Production verification checklist

After both providers report a successful deployment:

- Open the frontend URL and refresh at least one nested React route.
- Check the backend `/api/health` endpoint returns HTTP 200 and `database: ok`.
- Register a new test account, log out, and log back in.
- Confirm `/api/accounts` and `/api/chat` reject requests without a valid bearer token.
- Ask the chatbot for the signed-in user's balance, recent transactions, and pending bills; confirm answers use the demo records associated with that user.
- Register a second test account and confirm it has its own demo records, that transfers work for it, and that its chatbot context reflects only its own records (not another account's).
- Create a conversation, send messages, refresh the page, and reopen the conversation.
- Restart/redeploy the backend, then confirm the same user can still log in and retrieve the saved conversation. This is the practical persistence check for the mounted disk.
- Check browser developer tools and server logs for CORS, API, and provider errors. Do not expose tokens or secret values in screenshots or logs.

### SQLite backup and operations

The production database is `/var/data/finora.sqlite3` on the Render persistent disk. Before a backup, use SQLite's online backup API or stop writes and copy the database using the hosting provider's supported disk-access workflow. If using the SQLite CLI, run `sqlite3 /var/data/finora.sqlite3 '.backup /var/data/finora-backup.sqlite3'`; retain backups outside the same disk as well. Never commit the database or its `-wal` / `-shm` sidecar files.

Review Render service logs for startup and request failures. Restart/redeploy through the Render dashboard. The app initializes its schema on startup and backfills demo data for any user missing it. Keep the persistent disk attached during restarts and deploys. Basic rate limiting is built in (see below), but a public demo should still review cookie/token storage, secret rotation, backup retention, and privacy disclosures before sharing the URL widely.

### Local test commands for the new chatbot data integration

From the repository root, after installing `backend/requirements.txt`:

```bash
python -m unittest discover -s backend -p 'test*.py' -v
```

The new `backend/test_chatbot_data.py` suite uses temporary SQLite databases and mocks the OpenAI call. It checks database seeding/backfill, question-specific context selection, current-month spending calculation, bill data, and user isolation without requiring a paid API request.

**Deployment status:** The Render and Vercel configuration is prepared in this repository. A live deployment URL and production persistence verification are intentionally not claimed here; those steps require access to your hosting accounts and your secret OpenAI API key.

## What to demonstrate in an interview

1. Explain why Context is sufficient for this small demo and when Redux/Zustand would be justified.
2. Walk through a request from a React page through `services/api.js` to a Flask route.
3. Explain loading, empty, validation, timeout and connection-error states.
4. Demonstrate global transaction search, transaction filters/sorting, beneficiary add/edit, settings behavior, and responsive layouts.
5. Explain the error boundary and why React effects must not return Promises.
6. Show one frontend test and one Flask API test, then describe what each protects against.
7. Explain the server-side OpenAI integration, how the explicit test adapter differs from real inference, and why the assistant cannot operate a real bank account.

## Honest limitations

- Authentication uses expiring opaque bearer tokens stored in browser local storage; a production deployment should consider HttpOnly secure cookies, CSRF protections where applicable, a Content-Security-Policy and other security headers, and a formal security review. Basic rate limiting is implemented; see "Rate limiting".
- The original banking screens still use fictional frontend fixture state; authentication, session records, resource ownership metadata, beneficiaries, conversations and messages are persisted server-side. Banking balances, transactions, card freezes and read-notification state are not persisted.
- Transfers, bill payments and card controls are simulated.
- Real AI responses require a configured OpenAI API key; automated tests use a deterministic adapter that is explicitly labelled as not AI.
- The project has not been independently security-audited and is not production banking software.

## Portfolio presentation

Use a pinned GitHub repository with a clear README, screenshots, a short walkthrough video, meaningful commits and a deployed demo only after configuring a secure backend deployment. Add screenshots from your own running application rather than claiming a deployment or test result that you have not verified. In your resume, describe what you personally implemented and can explain.
