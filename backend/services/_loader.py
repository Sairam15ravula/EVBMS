"""
Shared joblib-loading helper. Every service module calls load(filename)
once (services load their own bundle at import time, and app.py's
startup hook forces that import for all services so nothing loads lazily
on the first request — see NFR "load models once at startup").

If a model file isn't present in backend/models/, load() returns None
and the calling service falls back to a documented formula instead of
crashing. This is the honest state the day this repo is cloned before
training/train_all.py has been run, and it's exactly how you'd want the
service to degrade if a model file goes missing in production too.
"""
import os
import joblib

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


def load(filename: str):
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        return None
    try:
        return joblib.load(path)
    except Exception as e:  # corrupted/incompatible file — degrade, don't crash
        print(f"[model-loader] failed to load {filename}: {e}")
        return None
