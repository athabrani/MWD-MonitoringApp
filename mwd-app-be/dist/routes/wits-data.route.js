import { Router } from "express";
import { acknowledgeWitsAlarm, getWitsAlarmEvents, getWitsDataValues, resolveWitsAlarm, } from "../controllers/wits-data.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
const witsDataRouter = Router();
const witsAlarmRouter = Router();
witsDataRouter.use(authenticate);
witsDataRouter.get("/", getWitsDataValues);
witsAlarmRouter.use(authenticate);
witsAlarmRouter.get("/", getWitsAlarmEvents);
witsAlarmRouter.put("/:id/acknowledge", authorize("admin", "engineer"), acknowledgeWitsAlarm);
witsAlarmRouter.put("/:id/resolve", authorize("admin", "engineer"), resolveWitsAlarm);
export { witsAlarmRouter, witsDataRouter };
//# sourceMappingURL=wits-data.route.js.map