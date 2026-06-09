import { Router } from "express";
import {
  generateWitsOutputFromLatest,
  getWitsOutputMessages,
  markWitsOutputStatus,
} from "../controllers/wits-output.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/queue", getWitsOutputMessages);
router.post(
  "/generate-from-latest",
  authorize("admin", "engineer"),
  generateWitsOutputFromLatest,
);
router.put("/:id/status", authorize("admin", "engineer"), markWitsOutputStatus);

export default router;
