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

router.post("/", authenticate, authorize("admin", "engineer"), createUser);
router.get("/", authenticate, authorize("admin", "engineer"), getAllUsers);
router.get("/:id", authenticate, authorize("admin", "engineer"), getUserById);
router.put("/:id", authenticate, authorize("admin", "engineer"), updateUser);
router.delete("/:id", authenticate, authorize("admin", "engineer"), deleteUser);

export default router;
