import { Router } from "express";
import {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession,
} from "../controllers/mwd-session.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize("admin", "engineer"), createSession);
router.get("/", getAllSessions);
router.get("/:id", getSessionById);
router.put("/:id", authorize("admin", "engineer"), updateSession);
router.delete("/:id", authorize("admin", "engineer"), deleteSession);

export default router;
