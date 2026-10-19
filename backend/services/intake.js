// Guided intake: allow-listed answers only (no free text except location),
// so nothing user-supplied can carry markup or instructions.
export const INTAKE_OPTIONS = {
    relationshipStatus: ["married", "separated", "divorced", "other", "unknown"],
    marriageType: ["hindu_rites", "special_marriage_act", "muslim_nikah", "other", "unknown"],
    hasDependentChildren: ["yes", "no", "unknown"],
    ownIncome: ["none", "some", "unknown"],
    respondentMeans: ["known", "partly", "unknown"],
    supportStatus: ["receiving", "order_exists", "none", "unknown"],
    safetyRisk: ["immediate", "yes", "no", "unknown"]
};

export const PENDING_OPTIONS = ["matrimonial", "dv", "maintenance", "none", "unknown"];
const LOCATION_PATTERN = /^[\p{L}\p{N} .,'-]{0,80}$/u;

export const defaultIntake = () => ({
    ...Object.fromEntries(Object.keys(INTAKE_OPTIONS).map((k) => [k, "unknown"])),
    pendingProceedings: ["unknown"],
    location: ""
});

// Missing answers become "unknown" so "I do not know" never breaks the flow.
export const validateIntake = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { errors: ["Request body must be an object"] };
    }
    const value = defaultIntake();
    const errors = [];

    for (const [field, options] of Object.entries(INTAKE_OPTIONS)) {
        if (body[field] === undefined) continue;
        if (typeof body[field] !== "string" || !options.includes(body[field])) {
            errors.push(`${field} must be one of: ${options.join(", ")}`);
        } else {
            value[field] = body[field];
        }
    }

    if (body.pendingProceedings !== undefined) {
        const list = body.pendingProceedings;
        if (!Array.isArray(list) || list.length > PENDING_OPTIONS.length ||
            list.some((x) => typeof x !== "string" || !PENDING_OPTIONS.includes(x))) {
            errors.push(`pendingProceedings must be a list of: ${PENDING_OPTIONS.join(", ")}`);
        } else {
            const unique = [...new Set(list)];
            value.pendingProceedings = unique.length ? unique : ["unknown"];
        }
    }

    if (body.location !== undefined) {
        const loc = typeof body.location === "string" ? body.location.trim() : null;
        if (loc === null || !LOCATION_PATTERN.test(loc)) {
            errors.push("location may contain letters, numbers, spaces and . , ' - (max 80 characters)");
        } else {
            value.location = loc;
        }
    }

    return errors.length ? { errors } : { value };
};

export const isSafetyRisk = (answers) =>
    ["immediate", "yes"].includes(answers.safetyRisk) ||
    (answers.pendingProceedings || []).includes("dv");
