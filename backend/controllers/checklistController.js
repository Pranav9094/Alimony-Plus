import { getOwnedCase } from "../utils/ownedCase.js";
import { loadIntake } from "./intakeController.js";
import { documentsForCase } from "./listDocumentsController.js";
import { buildChecklist } from "../services/checklist.js";

const checklistController = async (req, res) => {
    try {
        const { error, caseData } = await getOwnedCase(req.params.id, req.user.id);
        if (error) return res.status(error.status).json({ success: false, message: error.message });
        const intake = await loadIntake(caseData.id);
        const documents = await documentsForCase(caseData.id, req.user.id);
        res.status(200).json({
            success: true,
            intakeSaved: intake.saved,
            checklist: buildChecklist(intake.answers, documents)
        });
    } catch (err) {
        console.log("Checklist failed:", err.message);
        res.status(500).json({ success: false, message: "Failed to build checklist" });
    }
};

export default checklistController;
