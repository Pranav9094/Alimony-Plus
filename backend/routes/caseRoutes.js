import express from "express";
import createCase from "../controllers/caseController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import getCases from "../controllers/getCasesController.js";
import updateCase from "../controllers/updateCaseController.js";
import deleteCase from "../controllers/deleteCaseController.js";

import getCaseById from "../controllers/getCaseByIdController.js";
import validateId from "../middleware/validateIdMiddleware.js";
import { getIntake, saveIntake } from "../controllers/intakeController.js";
import navigatorController from "../controllers/navigatorController.js";
import checklistController from "../controllers/checklistController.js";

const router = express.Router();

router.post("/", authMiddleware, createCase);
router.get("/", authMiddleware, getCases);
router.get("/:id", authMiddleware, validateId, getCaseById);
router.put("/:id", authMiddleware, validateId, updateCase);
router.delete("/:id", authMiddleware, validateId, deleteCase);

// Guided intake, Legal-Route Navigator and Document Readiness checklist.
// POST (not PUT) for saving so the Next.js same-origin adapter can forward it.
router.get("/:id/intake", authMiddleware, validateId, getIntake);
router.post("/:id/intake", authMiddleware, validateId, saveIntake);
router.get("/:id/navigator", authMiddleware, validateId, navigatorController);
router.get("/:id/checklist", authMiddleware, validateId, checklistController);


export default router;