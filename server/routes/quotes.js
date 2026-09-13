import { Router } from "express";
import * as ctrl from "../controllers/quotes.js";
import {
  validateQuoteCalcKey,
  validateQuotePayload,
} from "../middleware/validate.js";
import { requireCalcPermission } from "../middleware/authorize.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/customers", requireAuth, ctrl.customers);

router.use("/:calcKey", validateQuoteCalcKey);

router.get("/:calcKey", requireCalcPermission("viewQuotes"), ctrl.list);
router.get("/:calcKey/count", requireCalcPermission("viewQuotes"), ctrl.count);
router.get("/:calcKey/next-id", requireCalcPermission("saveQuote"), ctrl.nextId);
router.post(
  "/:calcKey",
  validateQuotePayload,
  requireCalcPermission("saveQuote"),
  ctrl.create,
);
router.delete("/:calcKey/:id", requireCalcPermission("saveQuote"), ctrl.remove);

export default router;
