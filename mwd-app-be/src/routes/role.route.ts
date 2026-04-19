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

router.post("/", authenticate, authorize("Engineer"), createRole);
router.get("/", getAllRoles);
router.get("/:id", getRoleById);
router.put("/:id", authenticate, authorize("Engineer"), updateRole);
router.delete("/:id", authenticate, authorize("Engineer"), deleteRole);

export default router;
