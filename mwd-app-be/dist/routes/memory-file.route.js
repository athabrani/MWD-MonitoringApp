import express, { Router } from "express";
import { correlateMemoryFile, deleteMemoryFile, getMemoryCorrelations, getMemoryDataPoints, getMemoryFileById, getMemoryFiles, importMemoryFile, } from "../controllers/memory-file.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
const router = Router();
router.use(authenticate);
router.get("/", getMemoryFiles);
router.get("/correlations", getMemoryCorrelations);
router.post("/import", authorize("admin", "engineer"), express.text({
    type: ["text/*", "application/csv", "application/vnd.ms-excel"],
    limit: "10mb",
}), importMemoryFile);
router.get("/:id", getMemoryFileById);
router.get("/:id/points", getMemoryDataPoints);
router.post("/:id/correlate", authorize("admin", "engineer"), correlateMemoryFile);
router.delete("/:id", authorize("admin", "engineer"), deleteMemoryFile);
export default router;
//# sourceMappingURL=memory-file.route.js.map