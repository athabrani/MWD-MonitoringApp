import { Router } from "express";
import { getEspWebSocketStatus } from "../controllers/esp-websocket.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/status", getEspWebSocketStatus);

export default router;
