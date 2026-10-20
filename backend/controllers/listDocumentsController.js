import db from "../config/db.js";
import setRlsUser from "../utils/rlsContext.js";
import { getOwnedCase } from "../utils/ownedCase.js";

// Safe metadata only: never storage paths, file names on disk or file content.
export const documentsForCase = async (caseId, userId) =>
    db.transaction(async (tx) => {
        await setRlsUser(tx, db, userId);
        const rows = await tx.orm.public.Document.where((d) => d.caseId.eq(caseId)).all();
        return rows.map((d) => ({
            id: d.id,
            caseId: d.caseId,
            originalName: d.originalName,
            documentType: d.documentType || "Other",
            fileSize: d.fileSize,
            createdAt: d.createdAt
        }));
    });

const listDocuments = async (req, res) => {
    try {
        const { error, caseData } = await getOwnedCase(req.params.caseId, req.user.id);
        if (error) return res.status(error.status).json({ success: false, message: error.message });
        const documents = await documentsForCase(caseData.id, req.user.id);
        res.status(200).json({ success: true, documents });
    } catch (err) {
        console.log("Document list failed:", err.message);
        res.status(500).json({ success: false, message: "Failed to list documents" });
    }
};

export default listDocuments;
