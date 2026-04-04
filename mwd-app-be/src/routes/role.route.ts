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

router.post("/", authenticate, authorize("Admin"), createRole);
router.get("/", getAllRoles);
router.get("/:id", getRoleById);
router.put("/:id", authenticate, authorize("Admin"), updateRole);
router.delete("/:id", authenticate, authorize("Admin"), deleteRole);

export default router;
