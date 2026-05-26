# Socket.IO Implementation for MWD Monitoring App

## Overview

Socket.IO has been successfully implemented to enable real-time communication between the backend and frontend. This allows the frontend to receive live updates on MWD data, connection status, alerts, and other critical information without needing to poll the server.

## Architecture

### Backend Services

#### 1. **socket-io.service.ts**
Located in `src/services/socket-io.service.ts`

Core Socket.IO server setup and broadcast functions:

- `initializeSocketIO(httpServer)` - Initialize Socket.IO with HTTP server
- `broadcastMWDData(data)` - Broadcast new MWD data points
- `broadcastConnectionStatus(status)` - Broadcast connection status updates
- `broadcastESPGatewayStatus(status)` - Broadcast ESP gateway status
- `broadcastWITSData(data)` - Broadcast WITS data updates
- `broadcastAlert(alert)` - Broadcast alerts to all clients
- `broadcastError(error)` - Broadcast error messages

**Configuration:**
- CORS enabled for configured origin (default: `http://localhost:3000`)
- Supports both WebSocket and polling transports
- Socket path: `/socket.io`

#### 2. **server.ts Updates**
- Creates HTTP server with `http.createServer()`
- Initializes Socket.IO on server startup
- Maintains Express app compatibility

#### 3. **esp-websocket.service.ts Updates**
- Now broadcasts MWD data when successfully ingested
- Broadcasts gateway status on connection/disconnection
- Broadcasts gateway status on errors

## Socket.IO Events

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `request-latest-data` | (callback) | Client requests latest MWD data |
| `ping` | (callback) | Heartbeat/connection check |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ message, socketId, timestamp }` | Initial welcome message |
| `mwd-data` | MWD data object with timestamp | New MWD data received |
| `connection-status` | Connection status object | Connection status update |
| `esp-gateway-status` | Gateway status object | ESP gateway status update |
| `wits-data` | WITS data object | New WITS data |
| `alert` | Alert object | Alert message |
| `error` | Error object | Error notification |

## Frontend Integration

### Installation

```bash
npm install socket.io-client
```

### Environment Variables

Add to `.env.local`:
```
REACT_APP_SOCKET_URL=http://localhost:5001
```

### Basic Usage

See `docs/SOCKET_IO_CLIENT_EXAMPLE.ts` for a complete React hook example.

```typescript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

socket.on('mwd-data', (data) => {
  console.log('New MWD data:', data);
});

socket.on('esp-gateway-status', (status) => {
  console.log('Gateway status:', status);
});
```

### React Hook Example

Use the provided `useSocketIO()` hook to integrate Socket.IO into React components:

```typescript
function Dashboard() {
  const { 
    isConnected, 
    mwdData, 
    gatewayStatus, 
    alerts 
  } = useSocketIO();

  return (
    <div>
      <p>Status: {isConnected ? '✓ Connected' : '✗ Disconnected'}</p>
      <p>MWD Records: {mwdData.length}</p>
      {gatewayStatus && <p>Signal: {gatewayStatus.signal.quality}</p>}
    </div>
  );
}
```

## Data Flow

```
ESP Device (WebSocket)
    ↓
esp-websocket.service.ts (Receives & Ingests)
    ↓
gateway-ingest.service.ts (Processes & Stores)
    ↓
broadcastMWDData() ← MWD Data Emitted
    ↓
Socket.IO Server
    ↓
Connected Clients (Browser)
```

## Real-time Events Triggered

### 1. New MWD Data Arrival
- Data is ingested from ESP gateway
- Broadcast to all connected clients immediately
- Frontend chart updates in real-time

### 2. Gateway Connection Events
- On connect: Gateway status broadcasted
- On disconnect: Status update sent
- On error: Error status sent

### 3. Connection Status Changes
- New connection logged
- Status change broadcasted
- Clients notified for UI updates

## Performance Considerations

1. **Event Rate**: MWD data can broadcast frequently. Frontend should debounce chart updates if needed.
2. **Memory**: Last 100 MWD records kept in memory on client-side example.
3. **Scalability**: Socket.IO supports multiple adapters (Redis, etc.) for horizontal scaling.

## Testing Socket.IO Connection

### Backend Check

```bash
curl -i http://localhost:5001/socket.io/?EIO=4&transport=polling
```

Should return 200 OK.

### Frontend Check

Open browser console and run:
```javascript
const socket = io('http://localhost:5001');
socket.on('connect', () => console.log('Connected!'));
socket.on('mwd-data', (data) => console.log('MWD:', data));
```

## Troubleshooting

### CORS Issues
- Check `.env` file for correct `CORS_ORIGIN`
- Default: `http://localhost:3000`
- Update if frontend runs on different port

### Connection Refused
- Ensure backend is running on port 5001
- Check `PORT` environment variable
- Verify firewall settings

### No Data Received
- Check ESP gateway is connected and sending data
- Verify ESP gateway status in connection-status API
- Check browser DevTools Network tab for Socket.IO connections

## Future Enhancements

1. **Rooms**: Implement rooms for different drilling sites/sessions
2. **Namespaces**: Separate namespaces for different data types
3. **Redis Adapter**: Scale to multiple backend instances
4. **Authentication**: Add JWT verification for socket connections
5. **Compression**: Enable message compression for large payloads
6. **Middleware**: Add Socket.IO middleware for logging/monitoring

## Files Modified/Created

- ✅ Created: `src/services/socket-io.service.ts`
- ✅ Modified: `src/server.ts`
- ✅ Modified: `src/services/esp-websocket.service.ts`
- ✅ Created: `docs/SOCKET_IO_CLIENT_EXAMPLE.ts`
- ✅ Created: `docs/SOCKET_IO_IMPLEMENTATION.md` (this file)

## Next Steps

1. **Frontend Integration**: Use the provided React hook in components
2. **Add More Events**: Extend for depth tracking, alarms, etc.
3. **Add Authentication**: Secure Socket.IO connections with JWT
4. **Add Rooms**: Group clients by drilling session
5. **Performance Tuning**: Monitor and optimize event frequency

---

For questions or issues, refer to the Socket.IO documentation: https://socket.io/docs/
