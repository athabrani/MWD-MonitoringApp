import * as connectionStatusService from './connection-status.service.js'
import { GatewayIngestError } from './gateway-ingest.service.js'
import { submitGatewayCandidate } from './gateway-fusion.service.js'
import { createGatewayRawPacketLog } from './gateway-raw-packet-log.service.js'
import { parseSerialWitsBlock } from '../utils/serial-wits-parser.js'
import { resolveGatewaySessionId } from './gateway-session-resolver.service.js'
import {
  broadcastESPGatewayStatus,
} from './websocket.service.js'

type EspMessage = {
  type?: unknown
  data?: unknown
  rssi?: unknown
  snr?: unknown
}

type LoRaPacket = {
  payload: string
  metadata: Record<string, string>
}

export type EspWebSocketGatewayStatus = {
  enabled: boolean
  connected: boolean
  reconnecting: boolean
  url: string | null
  sessionId: number | null
  source: string
  transmitterId: string | null
  startedAt: string | null
  connectedAt: string | null
  lastReceivedAt: string | null
  lastIngestedAt: string | null
  lastMessageType: string | null
  lastRawMessage: string | null
  lastPayload: string | null
  lastError: string | null
  signal: {
    rssi: number | null
    snr: number | null
    sequence: string | null
    quality: 'unknown' | 'good' | 'fair' | 'poor'
    lastUpdatedAt: string | null
  }
  ingestedCount: number
  ignoredCount: number
}

const DEFAULT_RECONNECT_MS = 5000
const DEFAULT_INGEST_TYPES = ['rx', 'tx_ws_only', 'raw']

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const parsePositiveInt = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

const parsePositiveNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback
}

const parseSignalNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const match = value.match(/[-+]?\d+(?:\.\d+)?/)
  const parsed = match?.[0] ? Number(match[0]) : NaN

  return Number.isFinite(parsed) ? parsed : null
}

const getSignalQuality = (
  rssi: number | null,
  snr: number | null,
): 'unknown' | 'good' | 'fair' | 'poor' => {
  if (rssi === null && snr === null) {
    return 'unknown'
  }

  if ((rssi !== null && rssi <= -95) || (snr !== null && snr < 3)) {
    return 'poor'
  }

  if ((rssi !== null && rssi <= -80) || (snr !== null && snr < 7)) {
    return 'fair'
  }

  return 'good'
}

const runtimeStatus: EspWebSocketGatewayStatus = {
  enabled: false,
  connected: false,
  reconnecting: false,
  url: null,
  sessionId: null,
  source: 'esp32-websocket',
  transmitterId: null,
  startedAt: null,
  connectedAt: null,
  lastReceivedAt: null,
  lastIngestedAt: null,
  lastMessageType: null,
  lastRawMessage: null,
  lastPayload: null,
  lastError: null,
  signal: {
    rssi: null,
    snr: null,
    sequence: null,
    quality: 'unknown',
    lastUpdatedAt: null,
  },
  ingestedCount: 0,
  ignoredCount: 0,
}

const updateSignalStatus = (
  metadata: Record<string, string>,
  message: EspMessage,
  rawMessage: string,
) => {
  const rssi =
    parseSignalNumber(message.rssi) ??
    parseSignalNumber(metadata.RSSI) ??
    parseSignalNumber(rawMessage.match(/RSSI\s*=\s*([-+]?\d+(?:\.\d+)?)/i)?.[1])
  const snr =
    parseSignalNumber(message.snr) ??
    parseSignalNumber(metadata.SNR) ??
    parseSignalNumber(rawMessage.match(/SNR\s*=\s*([-+]?\d+(?:\.\d+)?)/i)?.[1])
  const sequence =
    metadata.SEQ ??
    rawMessage.match(/(?:^|[|\s,])SEQ\s*=\s*([A-Za-z0-9_.-]+)/i)?.[1] ??
    null

  if (rssi === null && snr === null && sequence === null) {
    return
  }

  runtimeStatus.signal.rssi = rssi ?? runtimeStatus.signal.rssi
  runtimeStatus.signal.snr = snr ?? runtimeStatus.signal.snr
  runtimeStatus.signal.sequence = sequence ?? runtimeStatus.signal.sequence
  runtimeStatus.signal.quality = getSignalQuality(
    runtimeStatus.signal.rssi,
    runtimeStatus.signal.snr,
  )
  runtimeStatus.signal.lastUpdatedAt = new Date().toISOString()
}

export const getEspWebSocketGatewayStatus = () => ({
  ...runtimeStatus,
})

const parseCsvSet = (value: unknown, fallback: string[]) => {
  if (typeof value !== 'string' || !value.trim()) {
    return new Set(fallback)
  }

  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return new Set(values.length ? values : fallback)
}

const parseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

const unwrapLoRaPacket = (value: string): LoRaPacket => {
  const parts = value.split('|')
  const metadata: Record<string, string> = {}
  let payloadStartIndex = 0

  for (const [index, part] of parts.entries()) {
    const match = part.match(/^([A-Z_]+)=(.*)$/)

    if (!match) {
      payloadStartIndex = index
      break
    }

    const key = match[1]
    const rawValue = match[2]

    if (key === undefined || rawValue === undefined) {
      payloadStartIndex = index
      break
    }

    if (
      key !== 'SEQ' &&
      key !== 'TS' &&
      key !== 'RX_TS' &&
      key !== 'RSSI' &&
      key !== 'SNR'
    ) {
      payloadStartIndex = index
      break
    }

    metadata[key] = rawValue
    payloadStartIndex = index + 1
  }

  return {
    metadata,
    payload: parts.slice(payloadStartIndex).join('|').trim(),
  }
}

const parseWitsPairs = (value: string) => {
  const wits: Record<string, string> = {}
  const lines = value
    .replace(/\r/g, '\n')
    .split(/[\n,;|]+/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (line === '&&' || line === '!!') {
      continue
    }

    const match =
      line.match(/^(\d{4})\s*[:=]\s*([-+]?\d+(?:\.\d+)?)/) ??
      line.match(/^(\d{4})\s+([-+]?\d+(?:\.\d+)?)/) ??
      line.match(/^(\d{4})([-+]?\d+(?:\.\d+)?)$/)

    if (match) {
      const witsId = match[1]
      const rawValue = match[2]

      if (witsId !== undefined && rawValue !== undefined) {
        wits[witsId] = rawValue
      }
    }
  }

  if (Object.keys(wits).length > 0) {
    return wits
  }

  const pairPattern = /\b(\d{4})\b\s*[:= ]\s*([-+]?\d+(?:\.\d+)?)/g
  for (const match of value.matchAll(pairPattern)) {
    const witsId = match[1]
    const rawValue = match[2]

    if (witsId !== undefined && rawValue !== undefined) {
      wits[witsId] = rawValue
    }
  }

  return wits
}

const messageDataToString = async (data: unknown) => {
  if (typeof data === 'string') {
    return data
  }

  if (Buffer.isBuffer(data)) {
    return data.toString('utf8')
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf8')
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
      'utf8',
    )
  }

  if (isRecord(data) && typeof data.arrayBuffer === 'function') {
    const arrayBuffer = await (
      data as { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer()
    return Buffer.from(arrayBuffer).toString('utf8')
  }

  return String(data)
}

const recordConnectionStatus = async (
  source: string,
  status: string,
  description: string,
  responseMs?: number,
) => {
  try {
    await connectionStatusService.createConnectionStatus({
      source,
      status,
      description,
      ...(responseMs !== undefined ? { responseMs } : {}),
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown connection log error'
    console.warn(`[ESP WS] Failed to record connection status: ${message}`)
  }
}

const toGatewayPayload = (
  message: EspMessage,
  defaultSessionId: number | null,
) => {
  if (isRecord(message.data)) {
    const payload: Record<string, unknown> = { ...message.data }

    if (payload.sessionId === undefined && defaultSessionId !== null) {
      payload.sessionId = defaultSessionId
    }

    return payload
  }

  if (typeof message.data !== 'string') {
    return null
  }

  const { metadata, payload } = unwrapLoRaPacket(message.data)

  if (!payload) {
    return null
  }

  const parsedPayload = parseJsonObject(payload)
  const parsedWitsBlock =
    !parsedPayload && payload.includes('&&') && payload.includes('!!')
      ? parseSerialWitsBlock(payload)
      : null
  const gatewayPayload: Record<string, unknown> = parsedPayload
    ? { ...parsedPayload }
    : parsedWitsBlock
      ? {
          wits: parsedWitsBlock.values,
          rawWitsBlock: parsedWitsBlock.rawBlock,
          raw: parsedWitsBlock.rawBlock,
          serialWitsLines: parsedWitsBlock.lines.map((line) => ({
            rawLine: line.rawLine,
            witsId: line.witsId,
            rawValue: line.rawValue,
            numericValue: line.numericValue,
            malformed: line.malformed,
            reason: line.reason,
          })),
        }
      : { wits: parseWitsPairs(payload) }

  if (
    !parsedPayload &&
    isRecord(gatewayPayload.wits) &&
    Object.keys(gatewayPayload.wits).length === 0
  ) {
    return null
  }

  if (gatewayPayload.sessionId === undefined && defaultSessionId !== null) {
    gatewayPayload.sessionId = defaultSessionId
  }

  if (metadata.SEQ !== undefined) {
    gatewayPayload.gatewaySequence = metadata.SEQ
  }

  if (metadata.TS !== undefined) {
    gatewayPayload.gatewayTxMillis = metadata.TS
  }

  if (message.rssi !== undefined) {
    gatewayPayload.gatewayRssi = message.rssi
  }

  if (message.snr !== undefined) {
    gatewayPayload.gatewaySnr = message.snr
  }

  return gatewayPayload
}

export const startEspWebSocketGateway = async () => {
  const url = process.env.ESP_WS_URL?.trim()

  if (!url) {
    runtimeStatus.enabled = false
    runtimeStatus.connected = false
    runtimeStatus.reconnecting = false
    runtimeStatus.url = null
    console.log('[ESP WS] Disabled. Set ESP_WS_URL to enable ESP ingestion.')
    return
  }

  const WebSocketClient = globalThis.WebSocket

  if (!WebSocketClient) {
    console.warn(
      '[ESP WS] WebSocket client is not available in this Node.js runtime.',
    )
    return
  }
  
  let defaultSessionId: number | null = null
  try {
    defaultSessionId = await resolveGatewaySessionId(
      process.env.ESP_GATEWAY_SESSION_ID,
      'ESP WS',
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown session resolver error'
    console.warn(`[ESP WS] ${message}`)
  }
  const reconnectMs = parsePositiveNumber(
    process.env.ESP_WS_RECONNECT_MS,
    DEFAULT_RECONNECT_MS,
  )
  const ingestTypes = parseCsvSet(
    process.env.ESP_WS_INGEST_TYPES,
    DEFAULT_INGEST_TYPES,
  )
  const source = process.env.ESP_GATEWAY_SOURCE?.trim() || 'esp32-websocket'
  const transmitterId = process.env.ESP_GATEWAY_TRANSMITTER_ID?.trim()
  let socket: WebSocket | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  let stopped = false
  let connectStartedAt = 0


  if (defaultSessionId === null) {
    console.warn(
      '[ESP WS] ESP_GATEWAY_SESSION_ID is not set. ESP payloads must include sessionId.',
    )
  }

  runtimeStatus.enabled = true
  runtimeStatus.connected = false
  runtimeStatus.reconnecting = false
  runtimeStatus.url = url
  runtimeStatus.sessionId = defaultSessionId
  runtimeStatus.source = source
  runtimeStatus.transmitterId = transmitterId || null
  runtimeStatus.startedAt = new Date().toISOString()
  runtimeStatus.connectedAt = null
  runtimeStatus.lastReceivedAt = null
  runtimeStatus.lastIngestedAt = null
  runtimeStatus.lastMessageType = null
  runtimeStatus.lastRawMessage = null
  runtimeStatus.lastPayload = null
  runtimeStatus.lastError = null
  runtimeStatus.signal = {
    rssi: null,
    snr: null,
    sequence: null,
    quality: 'unknown',
    lastUpdatedAt: null,
  }
  runtimeStatus.ingestedCount = 0
  runtimeStatus.ignoredCount = 0

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) {
      return
    }

    runtimeStatus.connected = false
    runtimeStatus.reconnecting = true
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, reconnectMs)
    reconnectTimer.unref()
  }

  const handleMessage = async (rawData: unknown) => {
    const rawMessage = await messageDataToString(rawData)
    const parsedMessage = parseJsonObject(rawMessage)
    const message: EspMessage = parsedMessage
      ? parsedMessage
      : { type: 'raw', data: rawMessage }
    const messageType =
      typeof message.type === 'string' && message.type.trim()
        ? message.type
        : 'raw'

    runtimeStatus.lastReceivedAt = new Date().toISOString()
    runtimeStatus.lastMessageType = messageType
    runtimeStatus.lastRawMessage = rawMessage

    const packet =
      typeof message.data === 'string' ? unwrapLoRaPacket(message.data) : null
    updateSignalStatus(packet?.metadata ?? {}, message, rawMessage)

    const sessionIdForLog =
      isRecord(message.data) && message.data.sessionId !== undefined
        ? parsePositiveInt(message.data.sessionId)
        : defaultSessionId
    const rawMessageRssi =
      rawMessage.match(/RSSI\s*=\s*([-+]?\d+(?:\.\d+)?)/i)?.[1] ?? null
    const rawMessageSnr =
      rawMessage.match(/SNR\s*=\s*([-+]?\d+(?:\.\d+)?)/i)?.[1] ?? null
    const packetRssi = packet?.metadata.RSSI ?? null
    const packetSnr = packet?.metadata.SNR ?? null
    const messageRssi =
      typeof message.rssi === 'string' || typeof message.rssi === 'number'
        ? message.rssi
        : null
    const messageSnr =
      typeof message.snr === 'string' || typeof message.snr === 'number'
        ? message.snr
        : null
    const rawPacketLog = await createGatewayRawPacketLog({
      channel: 'websocket',
      source,
      ...(sessionIdForLog !== null ? { sessionId: sessionIdForLog } : {}),
      messageType,
      rawMessage,
      ...(packet?.payload ? { payload: { payload: packet.payload } } : {}),
      sequence: packet?.metadata.SEQ ?? null,
      rssi: messageRssi ?? packetRssi ?? rawMessageRssi,
      snr: messageSnr ?? packetSnr ?? rawMessageSnr,
    })

    if (!ingestTypes.has(messageType)) {
      runtimeStatus.ignoredCount += 1
      return
    }

    const gatewayPayload = toGatewayPayload(message, defaultSessionId)

    if (!gatewayPayload) {
      runtimeStatus.ignoredCount += 1
      console.warn(
        `[ESP WS] Ignored ${messageType} message without MWD payload.`,
      )
      return
    }

    runtimeStatus.lastPayload =
      packet?.payload ??
      (typeof message.data === 'string'
        ? message.data
        : JSON.stringify(message.data))

    if (transmitterId && gatewayPayload.gatewayTransmitter === undefined) {
      gatewayPayload.gatewayTransmitter = transmitterId
    }

    try {
      const result = await submitGatewayCandidate({
        channel: 'websocket',
        source,
        payload: gatewayPayload,
        ...(rawPacketLog ? { rawPacketLogId: rawPacketLog.id } : {}),
      })

      if (result.selected) {
        runtimeStatus.ingestedCount += result.createdItems.length
        runtimeStatus.lastIngestedAt = new Date().toISOString()
        runtimeStatus.lastError = null
        console.log(
          `[ESP WS] Selected ${result.createdItems.length} MWD row(s) from ${messageType}.`,
        )
      } else {
        runtimeStatus.ignoredCount += 1
        console.log(
          `[ESP WS] Candidate skipped: ${result.reason}.`,
        )
      }

      // Broadcast updated gateway status
      broadcastESPGatewayStatus(getEspWebSocketGatewayStatus())
    } catch (error: unknown) {
      if (error instanceof GatewayIngestError) {
        runtimeStatus.lastError = error.message
        console.warn(`[ESP WS] Ingest rejected: ${error.message}`)
        return
      }

      const messageText =
        error instanceof Error ? error.message : 'Unknown ingest error'
      runtimeStatus.lastError = messageText
      console.error(`[ESP WS] Ingest failed: ${messageText}`)
    }
  }

  const connect = () => {
    if (stopped) {
      return
    }

    connectStartedAt = Date.now()
    console.log(`[ESP WS] Connecting to ${url}`)

    try {
      socket = new WebSocketClient(url)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown WebSocket error'
      runtimeStatus.lastError = message
      console.warn(`[ESP WS] Failed to create connection: ${message}`)
      void recordConnectionStatus(source, 'offline', message)
      scheduleReconnect()
      return
    }

    socket.addEventListener('open', () => {
      const responseMs = Date.now() - connectStartedAt
      runtimeStatus.connected = true
      runtimeStatus.reconnecting = false
      runtimeStatus.connectedAt = new Date().toISOString()
      runtimeStatus.lastError = null
      console.log(`[ESP WS] Connected to ${url}`)
      void recordConnectionStatus(
        source,
        'connected',
        `Connected to ${url}`,
        responseMs,
      )
      // Broadcast updated gateway status to frontend
      broadcastESPGatewayStatus(getEspWebSocketGatewayStatus())
    })

    socket.addEventListener('message', (event) => {
      void handleMessage(event.data)
    })

    socket.addEventListener('error', () => {
      runtimeStatus.lastError = `WebSocket error from ${url}`
      console.warn(`[ESP WS] Connection error from ${url}`)
      void recordConnectionStatus(
        source,
        'degraded',
        `WebSocket error from ${url}`,
      )
      // Broadcast updated gateway status to frontend
      broadcastESPGatewayStatus(getEspWebSocketGatewayStatus())
    })

    socket.addEventListener('close', (event) => {
      const reason = event.reason ? `: ${event.reason}` : ''
      runtimeStatus.connected = false
      runtimeStatus.lastError = `WebSocket closed (${event.code}${reason})`
      console.warn(`[ESP WS] Closed (${event.code}${reason})`)
      void recordConnectionStatus(
        source,
        'offline',
        `WebSocket closed (${event.code}${reason})`,
      )
      socket = null
      // Broadcast updated gateway status to frontend
      broadcastESPGatewayStatus(getEspWebSocketGatewayStatus())
      scheduleReconnect()
    })
  }

  connect()

  return () => {
    stopped = true
    runtimeStatus.enabled = false
    runtimeStatus.connected = false
    runtimeStatus.reconnecting = false

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    socket?.close()
    socket = null
  }
}
