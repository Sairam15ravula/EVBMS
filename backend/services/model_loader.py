"""
Centralized ML Model Loader, Metadata Parser, SHA256 Checksum Validator & Fallback Resilience Engine.
"""
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union

import joblib

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"


def calculate_sha256(filepath: Path) -> str:
    """Calculate SHA256 checksum of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


class ModelLoader:
    """Centralized loader managing ML model binaries, metadata, and fallback states."""

    def __init__(self, model_dir: Path = MODEL_DIR):
        self.model_dir = model_dir
        self.loaded_models: Dict[str, Any] = {}
        self.metadata_registry: Dict[str, Dict[str, Any]] = {}
        self.readiness_status: Dict[str, bool] = {}

    def load_model(
        self, model_filename: str, metadata_filename: Optional[str] = None
    ) -> Tuple[Optional[Any], bool]:
        """Load a model binary and validate its sidecar metadata and SHA256 checksum."""
        model_path = self.model_dir / model_filename
        if not model_path.exists():
            self.readiness_status[model_filename] = False
            return None, False

        meta_name = metadata_filename or f"{model_filename.replace('.joblib', '')}_metadata.json"
        meta_path = self.model_dir / meta_name

        metadata: Dict[str, Any] = {}
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                self.metadata_registry[model_filename] = metadata

                # Verify SHA256 if present in metadata
                expected_hash = metadata.get("sha256")
                if expected_hash:
                    actual_hash = calculate_sha256(model_path)
                    if actual_hash.lower() != expected_hash.lower():
                        print(f"[ModelLoader WARNING] Checksum mismatch for {model_filename}")
                        self.readiness_status[model_filename] = False
                        return None, False
            except Exception as e:
                print(f"[ModelLoader ERROR] Failed to parse metadata for {model_filename}: {e}")

        try:
            model = joblib.load(model_path)
            self.loaded_models[model_filename] = model
            self.readiness_status[model_filename] = True
            return model, True
        except Exception as e:
            print(f"[ModelLoader ERROR] Failed to load binary {model_filename}: {e}")
            self.readiness_status[model_filename] = False
            return None, False

    def get_status(self) -> Dict[str, Any]:
        return self.get_readiness()

    def get_readiness(self) -> Dict[str, Any]:
        """Return readiness dictionary for all registered models."""
        expected = [
            "soh_model_xgb.joblib",
            "rul_model_xgb.joblib",
            "telemetry_anomaly_model.joblib",
            "telemetry_isolation_forest.joblib",
            "capacity_fade_model.joblib",
            "charging_class_model_xgb.joblib",
        ]
        status = {}
        for name in expected:
            path = self.model_dir / name
            status[name] = path.exists() and self.readiness_status.get(name, True)
        return status


# Global singleton model loader instance
model_loader = ModelLoader()
