import { DRAFT_VERSION } from "./types";
import type {
  CauseOfActionId,
  CourtType,
  FilingDraft,
  Question,
  Role,
  SupportingDocument,
} from "./types";

export const SAMPLE_NOTICE =
  "Sample list for demonstration. Confirm court details with your lawyer or the court registry.";

export const COURT_TYPES: { value: CourtType; label: string }[] = [
  { value: "family-court", label: "Family Court" },
  { value: "district-court", label: "District Court" },
  { value: "magistrate-court", label: "Magistrate Court" },
];

export const SAMPLE_COURTS: Record<string, string[]> = {
  Delhi: ["New Delhi"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara"],
  Karnataka: ["Bengaluru"],
  Maharashtra: ["Mumbai", "Nagpur", "Pune"],
};

export const CAUSES: {
  id: CauseOfActionId;
  label: string;
  description: string;
}[] = [
  {
    id: "interim-maintenance",
    label: "Interim maintenance",
    description: "Temporary support while the main case is pending.",
  },
  {
    id: "permanent-alimony",
    label: "Permanent alimony",
    description: "Longer-term support decided with the final outcome.",
  },
  {
    id: "child-maintenance",
    label: "Child maintenance",
    description: "Support for the care and upbringing of a child.",
  },
  {
    id: "enforcement-of-order",
    label: "Enforcement of an existing order",
    description: "An order exists but payments are not being made.",
  },
  {
    id: "modification-of-order",
    label: "Change to an existing order",
    description: "Ask for an existing order to be reviewed or changed.",
  },
];

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const QUESTIONS: Record<CauseOfActionId, Question[]> = {
  "interim-maintenance": [
    {
      id: "im-separate",
      label: "Are you currently living separately from the other party?",
      type: "yesno",
      required: true,
      options: yesNo,
    },
    {
      id: "im-since",
      label: "Since when (month and year)?",
      hint: "For example: March 2025",
      type: "text",
      required: false,
    },
    {
      id: "im-need",
      label: "Briefly describe why interim support is needed",
      type: "textarea",
      required: true,
      appliesTo: ["petitioner"],
    },
    {
      id: "im-response",
      label: "Briefly describe your response to the claim",
      type: "textarea",
      required: true,
      appliesTo: ["respondent"],
    },
  ],
  "permanent-alimony": [
    {
      id: "pa-years",
      label: "How many years were you married?",
      type: "number",
      required: true,
    },
    {
      id: "pa-working",
      label: "Are you currently employed?",
      type: "yesno",
      required: true,
      options: yesNo,
    },
    {
      id: "pa-basis",
      label: "Briefly explain your position",
      type: "textarea",
      required: true,
    },
  ],
  "child-maintenance": [
    {
      id: "cm-count",
      label: "How many children does this concern?",
      type: "number",
      required: true,
    },
    {
      id: "cm-custody",
      label: "Who do the children currently live with?",
      type: "select",
      required: true,
      options: [
        { value: "me", label: "With me" },
        { value: "other", label: "With the other party" },
        { value: "shared", label: "Shared arrangement" },
      ],
    },
    {
      id: "cm-costs",
      label: "Describe the main costs (school, health, daily needs)",
      type: "textarea",
      required: true,
    },
  ],
  "enforcement-of-order": [
    {
      id: "eo-date",
      label: "Date of the existing order",
      hint: "DD/MM/YYYY",
      type: "text",
      required: true,
    },
    {
      id: "eo-unpaid",
      label: "Approximate amount currently unpaid (in rupees)",
      type: "number",
      required: true,
    },
    {
      id: "eo-details",
      label: "Describe what has happened since the order",
      type: "textarea",
      required: true,
    },
  ],
  "modification-of-order": [
    {
      id: "mo-date",
      label: "Date of the existing order",
      hint: "DD/MM/YYYY",
      type: "text",
      required: true,
    },
    {
      id: "mo-change",
      label: "What has changed in your circumstances?",
      type: "textarea",
      required: true,
    },
    {
      id: "mo-ask",
      label: "What change are you asking for?",
      type: "textarea",
      required: true,
    },
  ],
};

export const DEFAULT_DOCUMENTS: SupportingDocument[] = [
  { id: "doc-marriage", label: "Proof of marriage", available: false },
  { id: "doc-id", label: "Identity proof", available: false },
  { id: "doc-address", label: "Address proof", available: false },
  { id: "doc-income", label: "Income proof (salary slips, bank statements)", available: false },
  { id: "doc-orders", label: "Existing court orders, if any", available: false },
];

export function getQuestions(
  cause: CauseOfActionId | "",
  role: Role | "",
): Question[] {
  if (!cause) return [];
  return QUESTIONS[cause].filter(
    (q) => !q.appliesTo || (role !== "" && q.appliesTo.includes(role)),
  );
}

const emptyPerson = () => ({
  fullName: "",
  age: "",
  occupation: "",
  address: "",
  phone: "",
});

export function emptyDraft(): FilingDraft {
  return {
    version: DRAFT_VERSION,
    stage: 1,
    role: "",
    parties: { you: emptyPerson(), other: emptyPerson() },
    court: { state: "", district: "", courtType: "" },
    causeOfAction: "",
    answers: {},
    financial: {
      monthlyIncome: "",
      monthlyExpenses: "",
      dependants: "",
      otherIncomeNotes: "",
      documents: DEFAULT_DOCUMENTS.map((d) => ({ ...d })),
    },
    updatedAt: new Date().toISOString(),
  };
}