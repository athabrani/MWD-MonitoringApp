import { Router } from "express";
import { createConnectionStatus, getAllConnectionStatuses, getConnectionStatusById, updateConnectionStatus, deleteConnectionStatus, } from "../controllers/connection-status.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
const router = Router();
router.use(authenticate);
router.post("/", authorize("admin", "engineer"), createConnectionStatus);
router.get("/", getAllConnectionStatuses);
router.get("/:id", getConnectionStatusById);
router.put("/:id", authorize("admin", "engineer"), updateConnectionStatus);
router.delete("/:id", authorize("admin", "engineer"), deleteConnectionStatus);
export default router;
//# sourceMappingURL=connection-status.route.js.map