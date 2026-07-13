import { Router } from "express";
import {
  deleteSurveyConfig,
  getSurveyConfig,
  upsertSurveyConfig,
} from "../controllers/survey-config.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/:sessionId", getSurveyConfig);
router.put("/:sessionId", authorize("admin", "engineer"), upsertSurveyConfig);
router.post("/:sessionId", authorize("admin", "engineer"), upsertSurveyConfig);
router.delete("/:sessionId", authorize("admin", "engineer"), deleteSurveyConfig);

export default router;
