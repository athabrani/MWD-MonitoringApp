import { Router } from "express";
import {
  createMWDData,
  getAllMWDData,
  getMWDDataById,
  updateMWDData,
  deleteMWDData,
} from "../controllers/mwd-data.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", createMWDData);
router.get("/", getAllMWDData);
router.get("/:id", getMWDDataById);
router.put("/:id", updateMWDData);
router.delete("/:id", deleteMWDData);

export default router;
