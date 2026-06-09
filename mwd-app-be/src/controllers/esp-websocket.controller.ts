import type { Request, Response } from "express";
import { getEspWebSocketGatewayStatus } from "../services/esp-websocket.service.js";

export const getEspWebSocketStatus = (_req: Request, res: Response) => {
  res.json(getEspWebSocketGatewayStatus());
};
