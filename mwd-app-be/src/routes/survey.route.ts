import express, { Router } from "express";
import {
  createSurveyStation,
  deleteSurveyStation,
  getSurveyStationById,
  getSurveyStations,
  getSurveyTrajectoryPlotData,
  importSurveyFromMwdData,
  importWellPlanCsv,
  recalculateSurveyStations,
  updateSurveyStation,
} from "../controllers/survey.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getSurveyStations);
router.get("/trajectory", getSurveyTrajectoryPlotData);
router.post("/", authorize("admin", "engineer"), createSurveyStation);
router.post("/recalculate", authorize("admin", "engineer"), recalculateSurveyStations);
router.post("/from-mwd-data", authorize("admin", "engineer"), importSurveyFromMwdData);
router.post(
  "/well-plan/import-csv",
  authorize("admin", "engineer"),
  express.text({
    type: ["text/*", "application/csv", "application/vnd.ms-excel"],
    limit: "2mb",
  }),
  importWellPlanCsv,
);
router.get("/:id", getSurveyStationById);
router.put("/:id", authorize("admin", "engineer"), updateSurveyStation);
router.delete("/:id", authorize("admin", "engineer"), deleteSurveyStation);

export default router;
