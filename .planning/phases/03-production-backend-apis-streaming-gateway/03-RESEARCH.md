# Phase 3: Production Backend APIs & Streaming Gateway - Research

*Researched: 2026-08-17*

## Key Technical Decisions & Architecture

### 1. WebSocket Streaming Server in Node/Express
- **Package**: `ws` (`import { WebSocketServer } from 'ws'`)
- **Integration**:
  ```typescript
  import http from 'http';
  import { WebSocketServer } from 'ws';
  
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/telemetry' });
  
  wss.on('connection', (ws) => {
    console.log('Client connected to real-time telemetry stream');
    const interval = setInterval(() => {
      const frame = generateLiveTelemetryFrame(...);
      ws.send(JSON.stringify(frame));
    }, 1000);
    
    ws.on('close', () => clearInterval(interval));
  });
  ```

### 2. Express Rate Limiting
- **Package**: `express-rate-limit`
- **Configuration**:
  ```typescript
  import rateLimit from 'express-rate-limit';
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use('/api/', apiLimiter);
  ```

### 3. FastAPI CRUD & Pagination Architecture
- Use `Pydantic` schemas for query parameters (`limit: int = 50`, `offset: int = 0`, `vehicle_id: Optional[str] = None`).
- Leverage Phase 1 repositories (`VehicleRepository`, `TelemetryRepository`, `UserRepository`).

## Validation Architecture

### Verification Commands
- `curl -i http://localhost:3000/api/health`
- WebSocket connection verification to `ws://localhost:3000/ws/telemetry`
