# External & Internal Integrations

*Last mapped: 2026-08-17*

## External APIs & Services
- **Google Gemini AI API**:
  - **SDK**: `@google/genai` (v2.4.0)
  - **Model**: `gemini-3.6-flash`
  - **Auth**: `GEMINI_API_KEY` environment variable
  - **Usage**:
    - `POST /api/explain-degradation` (`server.ts`): Analyzes vehicle telemetry and physics-based health metrics to generate structured JSON XAI diagnoses (SEI layer growth, thermal stress, lithium plating risk, action plan).
    - `POST /api/chat-digital-doctor` (`server.ts`): Interactive conversation assistant providing NASA/CALCE benchmark-based battery diagnostics.
  - **Fallback**: Includes offline simulated JSON fallback when `GEMINI_API_KEY` is not present or invalid.

## Inter-Service Communication
- **Node.js Express Gateway → FastAPI ML Backend**:
  - **Gateway**: `server.ts` (listening on port 3000)
  - **Target**: `http://127.0.0.1:8000` (`backend/app.py` / `uvicorn`)
  - **Mechanism**: Express catch-all router (`app.all('/predict/*', ...)`) proxies HTTP requests to FastAPI.
  - **Fallback**: Returns JSON HTTP 503 error status if FastAPI backend is offline with instructions to launch `python app.py`.

## Data Sources & Research Benchmarks
- **NASA B0005 & CALCE Battery Datasets**:
  - Training dataset generator (`backend/training/generate_synthetic_data.py`) simulates capacity degradation curves, internal resistance growth, thermal runaways, and voltage drop cycles based on NASA Prognostics Center of Excellence (PCoE) battery aging standards.

## Hardware Telemetry & Sensor Input Simulation
- **Live Telemetry Stream**:
  - Simulated in `src/data/batteryData.ts` via `generateLiveTelemetryFrame()` and evaluated by `src/utils/analyticsEngine.ts`.
  - Simulates dynamic parameters: Voltage (V), Current (A), Temperature (°C), State of Charge (SoC %), State of Health (SoH %), Internal Resistance (mΩ), Cell Voltage Delta (mV), and Cycle Count.
