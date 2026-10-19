// Document Readiness checklist, mapped from blueprint section 15.
// Status comes only from documents the user has added; nothing is "verified"
// automatically and nothing is forced: missing records are fine.
export const DOCUMENT_TYPES = [
    "Identity / relationship",
    "Financial record",
    "Assets and liabilities",
    "Child expenses",
    "Court order",
    "Payment proof",
    "Safety record",
    "Other"
];

const has = (list, x) => (list || []).includes(x);

export const buildChecklist = (a, documents) => {
    const count = (type) => documents.filter((d) => d.documentType === type).length;
    const safetyRelevant = ["immediate", "yes"].includes(a.safetyRisk) || has(a.pendingProceedings, "dv");
    const caseOpen = ["matrimonial", "maintenance", "dv"].some((p) => has(a.pendingProceedings, p)) || a.supportStatus === "order_exists";

    const defs = [
        { key: "identity_marriage", label: "Identity and marriage", documentType: "Identity / relationship",
          examples: ["Identity proof", "Marriage certificate or registration", "Divorce papers, if applicable"],
          applies: true, priority: "start" },
        { key: "income", label: "Income", documentType: "Financial record",
          examples: ["Salary slips", "Bank statements", "Income tax documents, where available"],
          applies: true, priority: "start" },
        { key: "assets_liabilities", label: "Assets and liabilities", documentType: "Assets and liabilities",
          examples: ["Property details", "Loan obligations", "Major recurring commitments"],
          applies: true, priority: "optional" },
        { key: "children", label: "Children's expenses", documentType: "Child expenses",
          examples: ["School or tuition costs", "Medical costs", "Custody-related orders"],
          applies: a.hasDependentChildren !== "no", priority: "relevant" },
        { key: "court", label: "Court papers", documentType: "Court order",
          examples: ["Petition", "Order or notice", "Case number (CNR) and hearing dates"],
          applies: true, priority: caseOpen ? "start" : "optional" },
        { key: "payments", label: "Payments received", documentType: "Payment proof",
          examples: ["Bank entries", "Receipts", "Transfer history"],
          applies: true, priority: ["receiving", "order_exists"].includes(a.supportStatus) ? "relevant" : "optional" },
        { key: "safety", label: "Safety records (private)", documentType: "Safety record",
          examples: ["Protection order or complaint", "Medical or shelter records, where relevant"],
          applies: safetyRelevant, priority: "relevant", privateVault: true,
          note: "Add these only if it is safe to do so. A lawyer or legal-aid centre can help you keep them safe." }
    ];

    const items = defs.filter((d) => d.applies).map((d) => {
        const added = count(d.documentType);
        return { ...d, added, status: added ? "added" : "to_add", verified: false };
    });

    return {
        items,
        summary: {
            applicable: items.length,
            added: items.filter((i) => i.added > 0).length
        },
        guidance: "Missing information is okay. Add only what you have and what is needed. Records you add are not verified by Alimony+; a lawyer should check them before any filing."
    };
};
