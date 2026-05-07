import { Router } from "express";
import {
  exportHistoricalData,
  getExportRecords,
} from "../controllers/export.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate, authorize("admin", "engineer"));

router.post("/historical", exportHistoricalData);
router.get("/records", getExportRecords);

export default router;
