import { Router } from "express";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authenticate, authorize("Admin"), createUser);
router.get("/", authenticate, authorize("Admin"), getAllUsers);
router.get("/:id", authenticate, authorize("Admin"), getUserById);
router.put("/:id", authenticate, authorize("Admin"), updateUser);
router.delete("/:id", authenticate, authorize("Admin"), deleteUser);

export default router;
