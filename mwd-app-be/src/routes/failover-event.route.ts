import { Router } from "express";
import {
  createFailoverEvent,
  getAllFailoverEvents,
  getFailoverEventById,
  updateFailoverEvent,
  deleteFailoverEvent,
} from "../controllers/failover-event.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize("admin", "engineer"), createFailoverEvent);
router.get("/", getAllFailoverEvents);
router.get("/:id", getFailoverEventById);
router.put("/:id", authorize("admin", "engineer"), updateFailoverEvent);
router.delete("/:id", authorize("admin", "engineer"), deleteFailoverEvent);

export default router;
