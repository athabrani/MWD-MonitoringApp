import { Router } from "express";
import {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
} from "../controllers/role.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize("admin"), createRole);
router.get("/", getAllRoles);
router.get("/:id", getRoleById);
router.put("/:id", authorize("admin"), updateRole);
router.delete("/:id", authorize("admin"), deleteRole);

export default router;
