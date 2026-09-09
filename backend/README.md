# AI-Driven Battery Intelligence Platform — Backend

FastAPI + XGBoost/scikit-learn inference service, built to match the
PRD, Technology Stack, and (partially) UI/UX Design documents.

## What's real here and what isn't

- The **API, schemas, service structure, model file format, and the
  training pipeline are all real and runnable** — this isn't a stub.
- The **6 `.joblib` models currently in `models/` are placeholders**,
  trained on synthetic data (`training/generate_synthetic_data.py`)
  that follows the same knee-point aging pattern real Li-ion cells
  show, but is not the NASA Battery Aging Dataset or the CALCE Battery
  Dataset. See `models/README.md` for exactly how to swap in models
  trained on the real datasets — the rest of the backend does not need
  to change.
- Every endpoint also has a documented **fallback formula** for the
  (unlikely, once you've trained) case that a model file is missing, so
  the API never hard-fails just because a `.joblib` isn't there yet.
  Every response's `"source"` field tells you which path answered:
  `"trained_model"` or `"fallback_formula"`.

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt

# produces the 6 placeholder .joblib files + models/metrics_report.json
python training/train_all.py

uvicorn app:app --reload
```

Open `http://127.0.0.1:8000/docs` for interactive Swagger docs, or
`http://127.0.0.1:8000/` for a quick health check that also reports
which model files are currently loaded.

## Endpoints

| Method | Path                | Input model     |
| ------ | ------------------- | ---------------- |
| POST   | `/predict/soh`       | `SoHRequest`      |
| POST   | `/predict/rul`       | `RULRequest`      |
| POST   | `/predict/anomaly`   | `AnomalyRequest`  |
| POST   | `/predict/capacity`  | `CapacityRequest` |
| POST   | `/predict/charging`  | `ChargingRequest` |
| POST   | `/predict/all`       | any combination of the above, nested under `soh` / `rul` / `anomaly` / `capacity` / `charging` keys |
| GET    | `/`                  | health check + which models are loaded |

Exact field names are in `schemas/battery.py`, copied from the PRD's
"Implemented AI Model Mapping" table (section 7) and the tech-stack
doc's ML Stack table (section 5).

## Connecting the React dashboard to this backend

The dashboard artifact (`ev-battery-intelligence-platform.jsx`) currently
computes SoH/RUL/anomalies/etc. itself, client-side, with the same
transparent formulas used as this backend's fallback path — that's what
makes it work as a self-contained, zero-setup demo. To make it call
this real backend instead:

1. Run this backend (`uvicorn app:app --reload`) somewhere reachable
   from the browser running the dashboard — locally that's usually
   fine; for a hosted dashboard you'd deploy this behind HTTPS first.
2. In the dashboard's data layer (the `compute*` functions near the top
   of the `.jsx` file), replace the local calculation with a `fetch()`
   to the matching `/predict/*` endpoint, passing the same fields the
   endpoint expects, and use the returned value instead of the local
   one. `soh`, `rul`, and `capacity` are the most natural first ones to
   swap, since they map almost one-to-one already.
3. Keep the `"source"` field around in the UI somewhere (even just a
   tooltip) — it's a nice, honest touch for a viva to be able to show
   "this number came from the trained model," and it costs nothing
   since the backend already returns it.

## Folder structure

```
backend/
├── models/          trained .joblib files (+ metrics_report.json)
├── services/         one module per capability — model loading + prediction + fallback
├── routes/           FastAPI router (predict.py)
├── schemas/          Pydantic request/response models
├── training/          synthetic data generator + train_all.py
├── app.py            FastAPI app, CORS, startup hook, health check
└── requirements.txt
```

## Known gaps vs. the full PRD (be upfront about these in your report)

- No persistence layer yet (PRD section 10 lists this as optional /
  future-stack — the API is stateless for now, which matches "not
  required for the first local prototype").
- No auth — tech-stack doc section 13 flags this as a pre-production
  requirement, not a day-one one.
- SHAP/LIME aren't wired in as a separate endpoint; the ranked
  contributing-factors breakdown in the dashboard plays that role today
  via a transparent, non-model-based calculation. Adding a real
  `shap.TreeExplainer` on the XGBoost models (they're tree-based, so
  SHAP applies directly) is a natural next step and doesn't require
  changing the model files — only `services/*.py` and a new response
  field.
