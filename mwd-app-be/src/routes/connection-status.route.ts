import { Router } from "express";
import {
  createConnectionStatus,
  getAllConnectionStatuses,
  getConnectionStatusById,
  updateConnectionStatus,
  deleteConnectionStatus,
} from "../controllers/connection-status.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize("Engineer"), createConnectionStatus);
router.get("/", getAllConnectionStatuses);
router.get("/:id", getConnectionStatusById);
router.put("/:id", authorize("Engineer"), updateConnectionStatus);
router.delete("/:id", authorize("Engineer"), deleteConnectionStatus);

export default router;
