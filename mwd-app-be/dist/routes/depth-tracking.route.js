import { Router } from "express";
import { getDepthTrackingSamples, getDepthTrackingState, recalculateDepthTracking, updateDepthTrackingState, } from "../controllers/depth-tracking.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
const router = Router();
router.use(authenticate);
router.get("/state", getDepthTrackingState);
router.get("/samples", getDepthTrackingSamples);
router.post("/update", authorize("admin", "engineer"), updateDepthTrackingState);
router.post("/recalculate", authorize("admin", "engineer"), recalculateDepthTracking);
export default router;
//# sourceMappingURL=depth-tracking.route.js.map