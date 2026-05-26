import { Router } from "express";
import {
  exportHistoricalData,
  exportLasData,
  exportPdfPlot,
  exportSurveyData,
  exportSurveyDataAsExcel,
  exportSurveyDataAsPdf,
  getExportRecords,
} from "../controllers/export.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate, authorize("admin", "engineer"));

router.post("/historical", exportHistoricalData);
router.post("/surveys", exportSurveyData);
router.post("/las", exportLasData);
router.post("/pdf-plot", exportPdfPlot);
router.get("/records", getExportRecords);
router.post("/surveys/xlsx", exportSurveyDataAsExcel);
router.post("/surveys/pdf", exportSurveyDataAsPdf);

export default router;
