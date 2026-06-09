import { Router } from "express";
import { getEmailReportLogs, sendEmailReport, sendTestEmail, } from "../controllers/email-report.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
const router = Router();
router.use(authenticate, authorize("admin", "engineer"));
router.use((_req, res, next) => {
    if (process.env.EMAIL_REPORTS_ENABLED === "true") {
        return next();
    }
    return res.status(503).json({
        message: "Email reports are disabled",
        enableWith: "Set EMAIL_REPORTS_ENABLED=true",
    });
});
router.post("/email/test", sendTestEmail);
router.post("/email/send", sendEmailReport);
router.get("/email/logs", getEmailReportLogs);
export default router;
//# sourceMappingURL=email-report.route.js.map