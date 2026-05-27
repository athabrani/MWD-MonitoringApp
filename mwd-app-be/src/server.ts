import 'dotenv/config'
import { createServer } from 'http'
import app from './app.js'
import { initializeWebSocket } from "./services/websocket.service.js";
import { startEspWebSocketGateway } from './services/esp-websocket.service.js'
import { startSerialGateway } from './services/serial-gateway.service.js'
import { syncSystemRoles } from './services/role.service.js'

const portFromEnv = Number(process.env.PORT)
const PORT =
  Number.isFinite(portFromEnv) && portFromEnv > 0 ? portFromEnv : 5001

const startServer = async () => {
  await syncSystemRoles()

  // Create HTTP server for Express and native WebSocket
  const httpServer = createServer(app)

  // Initialize native WebSocket
  initializeWebSocket(httpServer)

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    startEspWebSocketGateway()
    void startSerialGateway()
  })
}

startServer().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown server startup error'
  console.error(`Failed to start server: ${message}`)
  process.exit(1)
})
