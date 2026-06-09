import { Router } from "express";
import { createWitsConfig, deleteWitsConfig, getAllWitsConfigs, getWitsConfigById, updateWitsConfig, } from "../controllers/wits-config.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
const router = Router();
router.use(authenticate);
router.get("/", getAllWitsConfigs);
router.post("/", authorize("admin", "engineer"), createWitsConfig);
router.get("/:id", getWitsConfigById);
router.put("/:id", authorize("admin", "engineer"), updateWitsConfig);
router.delete("/:id", authorize("admin", "engineer"), deleteWitsConfig);
export default router;
//# sourceMappingURL=wits-config.route.js.map