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

router.post("/", authenticate, authorize("Engineer"), createUser);
router.get("/", authenticate, authorize("Engineer"), getAllUsers);
router.get("/:id", authenticate, authorize("Engineer"), getUserById);
router.put("/:id", authenticate, authorize("Engineer"), updateUser);
router.delete("/:id", authenticate, authorize("Engineer"), deleteUser);

export default router;
