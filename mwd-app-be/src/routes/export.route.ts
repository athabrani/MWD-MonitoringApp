import { Router } from "express";
import {
  exportHistoricalData,
  exportLasData,
  exportPdfPlot,
  getExportRecords,
} from "../controllers/export.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate, authorize("admin", "engineer"));

router.post("/historical", exportHistoricalData);
router.post("/las", exportLasData);
router.post("/pdf-plot", exportPdfPlot);
router.get("/records", getExportRecords);

export default router;
