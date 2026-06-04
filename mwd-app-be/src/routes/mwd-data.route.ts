import { Router } from "express";
import {
  createMWDData,
  getAllMWDData,
  getMWDDataById,
  updateMWDData,
  deleteMWDData,
} from "../controllers/mwd-data.controller.js";
import {
  copyDepthRange,
  deleteDepthRange,
  getEditOperations,
  hideDepthRange,
  moveDepthRange,
  previewCopyDepthRange,
  previewMoveDepthRange,
  previewRescaleDepthRange,
  rescaleDepthRange,
  unhideDepthRange,
} from "../controllers/mwd-data-edit.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validation.middleware.js";
import {
  mwdDataCreateBodySchema,
  mwdDataUpdateBodySchema,
} from "../utils/request-schemas.js";

const router = Router();

router.use(authenticate);

router.get("/edit/operations", getEditOperations);
router.get("/edit/move-depth", authorize("admin", "engineer"), previewMoveDepthRange);
router.get("/edit/copy-depth", authorize("admin", "engineer"), previewCopyDepthRange);
router.get("/edit/rescale", authorize("admin", "engineer"), previewRescaleDepthRange);
router.post("/edit/hide-range", authorize("admin", "engineer"), hideDepthRange);
router.post("/edit/unhide-range", authorize("admin", "engineer"), unhideDepthRange);
router.post("/edit/delete-depth-range", authorize("admin", "engineer"), deleteDepthRange);
router.post("/edit/move-depth", authorize("admin", "engineer"), moveDepthRange);
router.post("/edit/copy-depth", authorize("admin", "engineer"), copyDepthRange);
router.post("/edit/rescale", authorize("admin", "engineer"), rescaleDepthRange);
router.post(
  "/",
  authorize("admin", "engineer"),
  validateBody(mwdDataCreateBodySchema),
  createMWDData,
);
router.get("/", getAllMWDData);
router.get("/:id", getMWDDataById);
router.put(
  "/:id",
  authorize("admin", "engineer"),
  validateBody(mwdDataUpdateBodySchema),
  updateMWDData,
);
router.delete("/:id", authorize("admin", "engineer"), deleteMWDData);

export default router;
