# TrustGuard AI

TrustGuard AI is a prototype browser safety tool that identifies common deceptive design patterns in web copy: false urgency, hidden cost language, and confirmshaming.

## Project folders

- `extension/` — unpacked Manifest V3 Chrome extension. It scans visible page text, highlights suspicious copy with a red outline and warning badge, and shows the last scan in its popup.
- `backend/` — standalone FastAPI service. `POST /analyze` accepts a JSON array of strings and returns explainable flagged items.
- `dashboard/` — an optional standalone Streamlit dashboard (`streamlit_app.py`) plus the full runnable web dashboard in `artifacts/trustguard-dashboard`. Both include recent scans, domain monitoring, pattern distribution, and a live scan action.

## Run the FastAPI service

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Test it:

```bash
curl -X POST http://localhost:8000/analyze \
  -H 'Content-Type: application/json' \
  -d '["Only 2 left — hurry!", "No thanks, I prefer paying full price"]'
```

The response is an array of objects containing `text`, `category`, `reason`, `threatScore`, and `signals`. CORS allows `chrome-extension://` origins so the extension can call this service directly.

## Load the Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the `extension/` folder.
4. Open a shopping or signup page, then click the TrustGuard AI toolbar icon.

The extension works locally with its explainable heuristic pass, so it remains useful even when the FastAPI service is not running.

## Run the dashboard

The dashboard workflow is already configured for this project. From the repository root:

```bash
pnpm --filter @workspace/trustguard-dashboard run dev
```

For a production bundle:

```bash
pnpm --filter @workspace/trustguard-dashboard run build
```

The dashboard's scan action uses the shared `/api/analyze` route in the workspace API server; the standalone FastAPI service is available for extension or external clients.

To run the optional Streamlit version instead:

```bash
pip install -r dashboard/requirements.txt
streamlit run dashboard/streamlit_app.py
```

Set `TRUSTGUARD_API_URL` if the FastAPI service is not running on `http://localhost:8000`.