import { ingestGatewayPayloads } from "./gateway-ingest.service.js";
type GatewayPayload = Record<string, unknown>;
export type GatewayFusionChannel = "websocket" | "serial";
export type GatewayFusionCandidate = {
    channel: GatewayFusionChannel;
    source: string;
    payload: GatewayPayload;
    receivedAt?: Date;
    rawPacketLogId?: bigint;
};
export type GatewayFusionResult = {
    selected: boolean;
    reason: string;
    createdItems: Awaited<ReturnType<typeof ingestGatewayPayloads>>;
    selectedChannel?: GatewayFusionChannel;
};
export declare const submitGatewayCandidate: (candidate: GatewayFusionCandidate) => Promise<GatewayFusionResult>;
export {};
//# sourceMappingURL=gateway-fusion.service.d.ts.map