import db from "../config/db.js";

// Resolve a case and verify that it belongs to the signed-in user.
// Returns { error: { status, message } } or { caseData }.
export const getOwnedCase = async (rawId, userId) => {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
        return { error: { status: 400, message: "Invalid Case ID" } };
    }
    const caseData = await db.orm.public.Case.where((c) => c.id.eq(id)).first();
    if (!caseData) {
        return { error: { status: 404, message: "Case not found" } };
    }
    if (caseData.userId !== userId) {
        return { error: { status: 403, message: "Access denied" } };
    }
    return { caseData };
};
