import { getEspWebSocketGatewayStatus } from "../services/esp-websocket.service.js";
export const getEspWebSocketStatus = (_req, res) => {
    res.json(getEspWebSocketGatewayStatus());
};
//# sourceMappingURL=esp-websocket.controller.js.map