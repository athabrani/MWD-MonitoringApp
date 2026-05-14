import { Router } from "express";
import {
  createPlotTemplate,
  deletePlotTemplate,
  getAllPlotTemplates,
  getDefaultPlotTemplate,
  getPlotTemplateById,
  updatePlotTemplate,
} from "../controllers/plot-template.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllPlotTemplates);
router.get("/default", getDefaultPlotTemplate);
router.post("/", authorize("admin", "engineer"), createPlotTemplate);
router.get("/:id", getPlotTemplateById);
router.put("/:id", authorize("admin", "engineer"), updatePlotTemplate);
router.delete("/:id", authorize("admin", "engineer"), deletePlotTemplate);

export default router;
