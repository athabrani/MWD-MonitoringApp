import { Router } from "express";
import {
  backupConfiguration,
  backupSessionData,
  clearSessionData,
  getConfigurationBackupTargets,
  getClearDataTargets,
  previewClearSessionData,
  restoreConfiguration,
  restoreSessionData,
} from "../controllers/system-utility.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin"));

router.get("/clear-data/targets", getClearDataTargets);
router.post("/backup-session", backupSessionData);
router.post("/clear-data/preview", previewClearSessionData);
router.post("/clear-data", clearSessionData);
router.post("/restore-session", restoreSessionData);
router.get("/config-backup/targets", getConfigurationBackupTargets);
router.post("/config-backup", backupConfiguration);
router.post("/config-restore", restoreConfiguration);

export default router;
