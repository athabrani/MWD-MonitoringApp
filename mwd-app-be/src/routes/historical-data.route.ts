import { Router } from "express";
import { getHistoricalData } from "../controllers/historical-data.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getHistoricalData);

export default router;
