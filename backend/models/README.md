# Models

The 6 `.joblib` files in this folder right now were produced by
`../training/train_all.py`, trained on **synthetic** data from
`../training/generate_synthetic_data.py` — not on the NASA Battery
Aging Dataset or the CALCE Battery Dataset. They exist so the API is
runnable end-to-end today, and so the model files (feature order,
joblib bundle shape) match exactly what `services/*.py` expect.

`metrics_report.json` has the honest evaluation numbers for each one
(MAE/RMSE/R² for the regressors, accuracy/precision/recall/F1/ROC-AUC
for the classifiers) — including notes on where a metric looks weak and
why (e.g. the telemetry-anomaly classifier's feature list, taken
directly from the PRD, doesn't include temperature/resistance, which
is what actually drives the injected incidents in the synthetic data).

## Swapping in the real thing

1. Download and feature-engineer the NASA / CALCE datasets so you have
   a table with (at minimum) the columns each service already expects —
   see the "Primary inputs" column in the PRD's section 7, or just read
   the `features` list each `services/*.py` file passes to its model.
2. Point `generate_synthetic_data.py`'s `build_datasets()` — or a new
   loader function with the same signature — at that real, engineered
   table instead of the synthetic generator.
3. Re-run `python train_all.py` from this folder's parent
   (`backend/training/`). It overwrites these 6 files and
   `metrics_report.json` with versions trained on real data. Nothing in
   `services/` or `routes/` needs to change — they only care about the
   joblib bundle's shape (`{"model": ..., "features": [...]}`, or for
   charging, `{"pipeline": ..., "label_encoder": ..., ...}`), not how it
   was trained.
4. Re-run the evaluation section of `train_all.py` (or your own,
   dataset-appropriate split) and update the numbers you report for the
   PRD's section 12 (Evaluation) and section 15 (Acceptance Criteria).

## If a file here is missing or deleted

Each service in `../services/` checks whether its `.joblib` file exists
at import time. If it's missing, that endpoint keeps working using a
documented formula instead of crashing — check the `"source"` field in
any `/predict/*` response: `"trained_model"` or `"fallback_formula"`.
