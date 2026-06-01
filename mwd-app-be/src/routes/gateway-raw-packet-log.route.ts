import { Router } from "express";
import {
  getGatewayRawPacketLogById,
  listGatewayRawPacketLogs,
} from "../controllers/gateway-raw-packet-log.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", listGatewayRawPacketLogs);
router.get("/:id", getGatewayRawPacketLogById);

export default router;
