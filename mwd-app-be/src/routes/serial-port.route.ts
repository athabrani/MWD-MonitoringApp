import { Router } from "express";
import {
  connectSerialPort,
  disconnectSerialPort,
  getSerialPorts,
  getSerialStatus,
} from "../controllers/serial-port.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/ports", getSerialPorts);
router.get("/status", getSerialStatus);
router.post("/connect", authorize("admin", "engineer"), connectSerialPort);
router.post("/disconnect", authorize("admin", "engineer"), disconnectSerialPort);

export default router;
