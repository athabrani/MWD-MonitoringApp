import { Router } from "express";
import {
  getAuditLogById,
  listAuditLogs,
} from "../controllers/audit-log.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate, authorize("admin", "engineer"));

router.get("/", listAuditLogs);
router.get("/:id", getAuditLogById);

export default router;
