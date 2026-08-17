# Phase 3: Production Backend APIs & Streaming Gateway - Research

*Researched: 2026-08-17*

## Key Technical Decisions & Architecture

### 1. Express WebSocket Streaming Server (`server.ts`)
- **Package**: `ws` (`import { WebSocketServer } from 'ws'`)
- **Transport**: WebSocket (`ws://`) ONLY — no SSE implementation.
- **Connection & Throttling Limits**:
  ```typescript
  import http from 'http';
  import { WebSocketServer, WebSocket } from 'ws';
  
  const MAX_WS_CONNECTIONS = 50;
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/telemetry' });
  
  wss.on('connection', (ws: WebSocket, req) => {
    if (wss.clients.size > MAX_WS_CONNECTIONS) {
      ws.close(1013, 'Max connection capacity reached');
      return;
    }
    
    // Per-connection message rate limit counter
    let msgCount = 0;
    const msgInterval = setInterval(() => { msgCount = 0; }, 1000);
    
    ws.on('message', (message) => {
      msgCount++;
      if (msgCount > 10) {
        ws.close(1008, 'Message rate limit exceeded');
        return;
      }
    });

    ws.on('close', () => clearInterval(msgInterval));
  });
  ```

### 2. Express Aggregated Health Check Endpoint (`GET /api/health`)
- Express owns public `/api/health` and queries both Express metrics and FastAPI backend `http://127.0.0.1:8000/`:
  ```typescript
  app.get('/api/health', async (req, res) => {
    let fastApiStatus = null;
    try {
      const resp = await fetch('http://127.0.0.1:8000/');
      fastApiStatus = await resp.json();
    } catch (e) {
      fastApiStatus = { status: 'offline' };
    }
    
    res.json({
      status: 'ok',
      service: 'Express Gateway',
      uptime: process.uptime(),
      websocket: {
        path: '/ws/telemetry',
        activeConnections: wss.clients.size,
        maxConnections: MAX_WS_CONNECTIONS
      },
      backend: fastApiStatus
    });
  });
  ```

### 3. FastAPI Fleet, Telemetry & RBAC Alert Endpoints
- **Historical Telemetry Bounded Query**:
  ```python
  @router.get("/history/{vehicle_id}")
  async def get_telemetry_history(
      vehicle_id: str,
      start_time: Optional[datetime] = None,
      end_time: Optional[datetime] = None,
      limit: int = Query(default=100, le=1000),
      offset: int = Query(default=0),
      session: AsyncSession = Depends(get_async_session)
  ):
      telemetry_repo = TelemetryRepository(session)
      return await telemetry_repo.get_history_bounded(vehicle_id, start_time, end_time, limit, offset)
  ```
- **Alert Acknowledgement with Phase 2 Auth/RBAC**:
  ```python
  @router.patch("/{alert_id}/acknowledge")
  async def acknowledge_alert(
      alert_id: str,
      current_user: UserModel = Depends(require_role(["admin", "fleet_manager", "technician"])),
      session: AsyncSession = Depends(get_async_session)
  ):
      telemetry_repo = TelemetryRepository(session)
      # Acknowledge alert via Phase 1 repo...
  ```

## Validation Architecture

### Verification Commands
- `curl -i http://localhost:3000/api/health`
- WebSocket connection test: `ws://localhost:3000/ws/telemetry`
