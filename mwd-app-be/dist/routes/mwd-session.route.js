import { Router } from "express";
import { createSession, getAllSessions, getSessionById, updateSession, deleteSession, } from "../controllers/mwd-session.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validation.middleware.js";
import { sessionCreateBodySchema, sessionUpdateBodySchema, } from "../utils/request-schemas.js";
const router = Router();
router.use(authenticate);
router.post("/", authorize("admin", "engineer"), validateBody(sessionCreateBodySchema), createSession);
router.get("/", getAllSessions);
router.get("/:id", getSessionById);
router.put("/:id", authorize("admin", "engineer"), validateBody(sessionUpdateBodySchema), updateSession);
router.delete("/:id", authorize("admin", "engineer"), deleteSession);
export default router;
//# sourceMappingURL=mwd-session.route.js.map