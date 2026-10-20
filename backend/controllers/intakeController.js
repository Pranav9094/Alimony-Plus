import db from "../config/db.js";
import createAuditLog from "../utils/auditLog.js";
import { getOwnedCase } from "../utils/ownedCase.js";
import { defaultIntake, validateIntake, isSafetyRisk } from "../services/intake.js";

export const loadIntake = async (caseId) => {
    const row = await db.orm.public.Intake.where({ caseId }).first();
    if (!row) return { saved: false, answers: defaultIntake(), safetyFlag: false };
    try {
        return { saved: true, answers: { ...defaultIntake(), ...JSON.parse(row.answers) }, safetyFlag: row.safetyFlag };
    } catch {
        return { saved: false, answers: defaultIntake(), safetyFlag: false };
    }
};

export const getIntake = async (req, res) => {
    try {
        const { error, caseData } = await getOwnedCase(req.params.id, req.user.id);
        if (error) return res.status(error.status).json({ success: false, message: error.message });
        const intake = await loadIntake(caseData.id);
        res.status(200).json({ success: true, intake });
    } catch (err) {
        console.log("Intake read failed:", err.message);
        res.status(500).json({ success: false, message: "Failed to get intake" });
    }
};

export const saveIntake = async (req, res) => {
    try {
        const { error, caseData } = await getOwnedCase(req.params.id, req.user.id);
        if (error) return res.status(error.status).json({ success: false, message: error.message });

        const { errors, value } = validateIntake(req.body);
        if (errors) return res.status(400).json({ success: false, message: errors[0], errors });

        const safetyFlag = isSafetyRisk(value);
        const answers = JSON.stringify(value);
        const existing = await db.orm.public.Intake.where({ caseId: caseData.id }).first();
        if (existing) {
            await db.orm.public.Intake.where({ id: existing.id }).update({ answers, safetyFlag });
        } else {
            await db.orm.public.Intake.create({ caseId: caseData.id, userId: req.user.id, answers, safetyFlag });
        }

        // Never log the answers themselves: they are sensitive.
        await createAuditLog({
            userId: req.user.id,
            action: "INTAKE_SAVED",
            entityType: "Intake",
            entityId: caseData.id,
            metadata: `caseId=${caseData.id}`
        });

        res.status(200).json({ success: true, intake: { saved: true, answers: value, safetyFlag } });
    } catch (err) {
        console.log("Intake save failed:", err.message);
        res.status(500).json({ success: false, message: "Failed to save intake" });
    }
};
