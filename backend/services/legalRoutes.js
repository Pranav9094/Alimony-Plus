// Legal-Route Navigator rules, mapped from the Tech Tomorrow blueprint
// (sections 04, 05, 08 and 12). Every route carries source, effective date
// and review date. Nothing here decides entitlement or an amount.
const REVIEWED_ON = "2026-10-06";
const REVIEW_STATUS = "pending-legal-review";
const src = (title, url, effectiveFrom = null) => ({
    title, url, effectiveFrom, reviewedOn: REVIEWED_ON, reviewStatus: REVIEW_STATUS
});

export const ROUTES = {
    bnss_144: {
        id: "bnss_144",
        title: "Maintenance order under BNSS s.144",
        explainer: "A court route for maintenance of wives, children and parents where the statutory conditions are met. It can also include interim maintenance while the case is pending.",
        questionsForCounsel: [
            "Do the statutory conditions apply to my facts?",
            "Which court should I file in, and what documents are needed?",
            "Can I ask for interim maintenance while the case is pending?"
        ],
        source: src("BNSS 2023, s.144", "https://indiacode.ecourtsindia.com/bnss/section/144/", "2024-07-01")
    },
    hma_24: {
        id: "hma_24",
        title: "Interim maintenance under Hindu Marriage Act s.24",
        explainer: "While a Hindu Marriage Act case is going on, either spouse who lacks enough independent income can ask for interim maintenance and case expenses. The law says such applications should, as far as possible, be decided within 60 days of notice being served.",
        questionsForCounsel: [
            "Can I apply now, and what income and expense details will the court expect?",
            "How is the 60-day target tracked in my court?"
        ],
        source: src("Hindu Marriage Act 1955, s.24", "https://indiacode.ecourtsindia.com/hindu-marriage-act/section/24/")
    },
    hma_25: {
        id: "hma_25",
        title: "Permanent alimony under Hindu Marriage Act s.25",
        explainer: "A longer-term maintenance order that can be made at the time of a decree or later, on application, after the court considers the circumstances the law lists.",
        questionsForCounsel: [
            "Is a post-decree application possible in my situation?",
            "Which documents should I prepare first?"
        ],
        source: src("Hindu Marriage Act 1955, s.25", "https://indiacode.ecourtsindia.com/hindu-marriage-act/section/25/")
    },
    hama_18: {
        id: "hama_18",
        title: "Maintenance of a Hindu wife under HAMA s.18",
        explainer: "A separate route for a Hindu wife during the marriage, subject to the section's conditions. It is available without a matrimonial case pending, and it is different from HMA s.24 and s.25.",
        questionsForCounsel: [
            "Do the conditions in s.18 apply to me?",
            "Is this route better than, or in addition to, BNSS s.144 for my situation?"
        ],
        source: src("Hindu Adoptions and Maintenance Act 1956, s.18", "https://indiacode.ecourtsindia.com/hindu-adoptions-maintenance-act-1956/section/18/")
    },
    sma_36_37: {
        id: "sma_36_37",
        title: "Alimony under the Special Marriage Act ss.36-37",
        explainer: "The Special Marriage Act has separate provisions for alimony while a case is pending (s.36) and for permanent alimony (s.37) in the proceedings where they apply.",
        questionsForCounsel: [
            "Which of s.36 or s.37 fits the stage of my case?",
            "What do I need to show the court?"
        ],
        source: src("Special Marriage Act 1954, ss.36-37", "https://indiacode.ecourtsindia.com/special-marriage-act-1954/section/36/")
    },
    muslim_divorced: {
        id: "muslim_divorced",
        title: "Divorced Muslim women: maintenance remedies",
        explainer: "In July 2024 the Supreme Court held that the old CrPC s.125 maintenance route is available to divorced Muslim women, in addition to remedies under the 1986 Act. Because BNSS is now in force, the current equivalent provision and any personal-law questions need a lawyer to confirm.",
        questionsForCounsel: [
            "Which provision now corresponds to the old CrPC s.125 route?",
            "Which of the available remedies suits my situation?"
        ],
        source: src("Mohd Abdul Samad v. State of Telangana", "https://indiankanoon.org/doc/7964121/", "2024-07-10")
    },
    dv_s20: {
        id: "dv_s20",
        title: "Monetary relief under the Domestic Violence Act s.20",
        explainer: "In domestic-violence proceedings the court can order monetary reliefs, which can include maintenance, alongside protection, residence and custody orders.",
        questionsForCounsel: [
            "Which protection and monetary reliefs can I ask for together?",
            "How do I keep my records and evidence safe?"
        ],
        source: src("Protection of Women from Domestic Violence Act 2005, s.20", "https://www.indiacode.nic.in/handle/123456789/2021")
    }
};

export const LEGAL_AID = {
    title: "Free legal aid (NALSA / DLSA / SLSA)",
    helpline: "15100",
    explainer: "Women can seek free legal assistance through the Taluk Legal Services Committee, the District Legal Services Authority, the State Legal Services Authority, Legal Aid Clinics, an online application, or the NALSA helpline.",
    source: src("NALSA: Assistance for Women", "https://nalsa.gov.in/womens-assistance/")
};

export const SAFETY = {
    title: "Your safety comes first",
    message: "Because you mentioned a safety risk, the normal case steps are paused. Please reach out to emergency or legal-aid help first. You can return to your case at any time.",
    contacts: [
        { label: "Emergency services (India)", value: "112" },
        { label: "NALSA legal-aid helpline", value: "15100" }
    ],
    note: "Emergency contacts must be verified for the user's jurisdiction before public launch."
};

export const DISCLAIMER =
    "These are possible legal routes based on the answers you gave. This is general information, not legal advice, and it does not decide what you are entitled to. A lawyer or legal-aid professional can confirm which route fits your case.";

const has = (list, x) => (list || []).includes(x);

export const buildNavigator = (a) => {
    const routes = [];
    const add = (id, reason) => {
        const found = routes.find((r) => r.id === id);
        if (found) { found.reasons.push(reason); return; }
        routes.push({ ...ROUTES[id], confidence: "possible", reasons: [reason] });
    };

    const matrimonial = has(a.pendingProceedings, "matrimonial");
    const hindu = a.marriageType === "hindu_rites";
    const married = ["married", "separated"].includes(a.relationshipStatus);
    const divorced = a.relationshipStatus === "divorced";

    if (a.relationshipStatus !== "other") {
        add("bnss_144", "Available as a general maintenance route for wives, children and parents where the conditions are met.");
    }
    if (hindu && matrimonial) add("hma_24", "You married under Hindu rites and a matrimonial case is pending.");
    if (hindu && (divorced || matrimonial)) add("hma_25", divorced ? "You married under Hindu rites and are divorced." : "You married under Hindu rites and a matrimonial case is pending.");
    if (hindu && married && !matrimonial) add("hama_18", "You married under Hindu rites, the marriage continues, and no matrimonial case is pending.");
    if (a.marriageType === "special_marriage_act" && (matrimonial || divorced)) add("sma_36_37", "You married under the Special Marriage Act and are in or after a matrimonial case.");
    if (a.marriageType === "muslim_nikah" && divorced) add("muslim_divorced", "You are a divorced Muslim woman; more than one remedy may be open to you.");
    if (isSafety(a)) add("dv_s20", "You mentioned domestic violence or a safety risk.");

    const pendingCount = (a.pendingProceedings || []).filter((x) => ["matrimonial", "dv", "maintenance"].includes(x)).length;
    const overlap = pendingCount >= 2 || (a.supportStatus === "order_exists" && has(a.pendingProceedings, "maintenance"));

    return {
        safetyFirst: isSafety(a),
        safety: isSafety(a) ? SAFETY : null,
        routes,
        needsMoreInfo: ["marriageType", "relationshipStatus"].filter((f) => ["unknown", "other"].includes(a[f])),
        overlapWarning: overlap
            ? "More than one maintenance-related case or order may exist. Overlapping proceedings can matter. Please share the details with a lawyer or legal-aid professional."
            : null,
        existingOrderNote: a.supportStatus === "order_exists"
            ? "You said an order already exists. Keep the order and payment records together; the case tracker can help you log payments."
            : null,
        legalAid: LEGAL_AID,
        disclaimer: DISCLAIMER
    };
};

function isSafety(a) {
    return ["immediate", "yes"].includes(a.safetyRisk) || has(a.pendingProceedings, "dv");
}
