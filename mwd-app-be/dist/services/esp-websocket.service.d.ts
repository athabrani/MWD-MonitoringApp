export type EspWebSocketGatewayStatus = {
    enabled: boolean;
    connected: boolean;
    reconnecting: boolean;
    url: string | null;
    sessionId: number | null;
    source: string;
    transmitterId: string | null;
    startedAt: string | null;
    connectedAt: string | null;
    lastReceivedAt: string | null;
    lastIngestedAt: string | null;
    lastMessageType: string | null;
    lastRawMessage: string | null;
    lastPayload: string | null;
    lastError: string | null;
    signal: {
        rssi: number | null;
        snr: number | null;
        sequence: string | null;
        quality: 'unknown' | 'good' | 'fair' | 'poor';
        lastUpdatedAt: string | null;
    };
    ingestedCount: number;
    ignoredCount: number;
};
export declare const getEspWebSocketGatewayStatus: () => {
    enabled: boolean;
    connected: boolean;
    reconnecting: boolean;
    url: string | null;
    sessionId: number | null;
    source: string;
    transmitterId: string | null;
    startedAt: string | null;
    connectedAt: string | null;
    lastReceivedAt: string | null;
    lastIngestedAt: string | null;
    lastMessageType: string | null;
    lastRawMessage: string | null;
    lastPayload: string | null;
    lastError: string | null;
    signal: {
        rssi: number | null;
        snr: number | null;
        sequence: string | null;
        quality: "unknown" | "good" | "fair" | "poor";
        lastUpdatedAt: string | null;
    };
    ingestedCount: number;
    ignoredCount: number;
};
export declare const startEspWebSocketGateway: () => (() => void) | undefined;
//# sourceMappingURL=esp-websocket.service.d.ts.map