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

router.post("/", authorize("Engineer"), createFailoverEvent);
router.get("/", getAllFailoverEvents);
router.get("/:id", getFailoverEventById);
router.put("/:id", authorize("Engineer"), updateFailoverEvent);
router.delete("/:id", authorize("Engineer"), deleteFailoverEvent);

export default router;
