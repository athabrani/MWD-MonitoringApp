import { Router } from "express";
import { ingestMWDData } from "../controllers/gateway.controller.js";
import { authenticateGateway } from "../middlewares/gateway.middleware.js";

const router = Router();

router.post("/mwd-data", authenticateGateway, ingestMWDData);

export default router;
