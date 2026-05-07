import { Router } from "express";
import {
  createMWDData,
  getAllMWDData,
  getMWDDataById,
  updateMWDData,
  deleteMWDData,
} from "../controllers/mwd-data.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", authorize("admin", "engineer"), createMWDData);
router.get("/", getAllMWDData);
router.get("/:id", getMWDDataById);
router.put("/:id", authorize("admin", "engineer"), updateMWDData);
router.delete("/:id", authorize("admin", "engineer"), deleteMWDData);

export default router;
