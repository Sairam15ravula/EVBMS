"""
Model Retraining Script Wrapper for EV Battery Intelligence Platform.
Delegates to backend.training.train_models.
"""
import sys
from pathlib import Path

# Add root directory to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.training.train_models import run_training

if __name__ == "__main__":
    run_training()
