import { Router } from "express";
import {
  getAuditLogById,
  listAuditLogs,
} from "../controllers/audit-log.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", listAuditLogs);
router.get("/:id", getAuditLogById);

export default router;
