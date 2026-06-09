import { Router } from "express";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validation.middleware.js";
import {
  userCreateBodySchema,
  userUpdateBodySchema,
} from "../utils/request-schemas.js";

const router = Router();

router.use(authenticate, authorize("admin"));

router.post("/", validateBody(userCreateBodySchema), createUser);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:id", validateBody(userUpdateBodySchema), updateUser);
router.delete("/:id", deleteUser);

export default router;
