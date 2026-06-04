import { Router } from "express";
import { login, logout, me } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validation.middleware.js";
import { loginBodySchema } from "../utils/request-schemas.js";

const router = Router();

router.post("/login", validateBody(loginBodySchema), login);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
