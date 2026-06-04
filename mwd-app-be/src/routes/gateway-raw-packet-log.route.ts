import { Router } from "express";
import {
  getGatewayRawPacketLogById,
  listGatewayRawPacketLogs,
} from "../controllers/gateway-raw-packet-log.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate, authorize("admin", "engineer"));

router.get("/", listGatewayRawPacketLogs);
router.get("/:id", getGatewayRawPacketLogById);

export default router;
