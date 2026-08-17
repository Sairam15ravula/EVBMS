# Coding Conventions & Patterns

*Last mapped: 2026-08-17*

## TypeScript & React Standards

### Component Structure & Syntax
- **Functional Components**: All UI components are written as React functional components using TypeScript (`export const MetricCards: React.FC<MetricCardsProps> = (...) =>`).
- **Props Typing**: Interface declarations for component props placed in `src/types.ts` or near the component file.
- **Hooks Usage**: State management relies on standard React hooks (`useState`, `useRef`, `useEffect`, `useMemo`).
- **UI & Animation**: Tailwind CSS utility classes are used for styling, combined with Framer Motion (`motion.div`, `AnimatePresence`) for state transitions.

### Type Declarations (`src/types.ts`)
- Centralized TypeScript interfaces define core entities:
  - `Vehicle`: Metadata (id, name, model, chemistry, pack capacity, nominal voltage).
  - `TelemetryFrame`: Real-time telemetry readings (timestamp, voltage, current, temp, SoC, SoH, resistance, cycle count).
  - `HealthMetrics`: Derived metrics (SoH %, RUL cycles/years, risk level, diagnostic alerts).
  - `AIExplainResponse`: Structured XAI response object.

### Error Handling & API Responses
- Express API endpoints return consistent JSON structures:
  - Success: `{ success: true, aiAnalysis: ... }` or `{ reply: "...", suggestedActions: [...] }`
  - Error: `res.status(500).json({ error: 'Descriptive error message', details: error.message })`
- Graceful Fallback: When `GEMINI_API_KEY` is unavailable, API endpoints return simulated mock data instead of crashing.

---

## Python Backend Standards

### Code Style & Formatting
- **PEP 8 Compliance**: Modules, functions, and variables use `snake_case` (`predict_soh`, `generate_synthetic_data`). Classes and Pydantic models use `PascalCase` (`SoHRequest`, `AnomalyResponse`).
- **Type Annotations**: All service methods and API handlers include explicit type hints.

### Architecture Patterns
- **Pydantic Validation (`backend/schemas/battery.py`)**: All FastAPI requests use Pydantic models with field validation and default values.
- **Service Layer Pattern**: Each ML model domain has a dedicated service module in `backend/services/` (`soh.py`, `rul.py`, `anomaly.py`, `capacity.py`, `charging.py`).
- **Model Loading (`backend/services/_loader.py`)**: Models are loaded once at startup via `joblib.load()` into a process-wide `MODELS` dict.
- **Physics-Based Fallbacks**: If a `.joblib` model binary is missing from `backend/models/`, the service catches the missing model and executes a documented physical calculation (e.g., NASA capacity degradation exponential formula), setting `source="physics_fallback"`.

```python
# Example service fallback pattern (backend/services/soh.py)
def predict_soh(cycle: int, voltage: float, temperature: float, capacity: float, init_capacity: float = 2.0):
    model = get_model("soh_model_xgb.joblib")
    if model is not None:
        X = np.array([[cycle, voltage, temperature, capacity, init_capacity]])
        pred = float(model.predict(X)[0])
        return pred, "xgb_model"
    # Physics-based fallback formula
    soh_est = (capacity / init_capacity) * 100.0 if init_capacity > 0 else 100.0
    return soh_est, "physics_fallback"
```
