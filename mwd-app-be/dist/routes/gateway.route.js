import { Router } from "express";
import { ingestMWDData } from "../controllers/gateway.controller.js";
import { authenticateGateway } from "../middlewares/gateway.middleware.js";
import { validateBody } from "../middlewares/validation.middleware.js";
import { gatewayBodySchema } from "../utils/request-schemas.js";
const router = Router();
router.post("/mwd-data", authenticateGateway, validateBody(gatewayBodySchema), ingestMWDData);
export default router;
//# sourceMappingURL=gateway.route.js.map