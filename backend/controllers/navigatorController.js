import { getOwnedCase } from "../utils/ownedCase.js";
import { loadIntake } from "./intakeController.js";
import { buildNavigator } from "../services/legalRoutes.js";

const navigatorController = async (req, res) => {
    try {
        const { error, caseData } = await getOwnedCase(req.params.id, req.user.id);
        if (error) return res.status(error.status).json({ success: false, message: error.message });
        const intake = await loadIntake(caseData.id);
        res.status(200).json({
            success: true,
            intakeSaved: intake.saved,
            navigator: buildNavigator(intake.answers)
        });
    } catch (err) {
        console.log("Navigator failed:", err.message);
        res.status(500).json({ success: false, message: "Failed to build legal routes" });
    }
};

export default navigatorController;
