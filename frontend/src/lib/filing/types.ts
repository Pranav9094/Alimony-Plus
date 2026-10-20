export const DRAFT_VERSION = 1;

export type Role = "petitioner" | "respondent";
export type StageId = 1 | 2 | 3 | 4 | 5 | 6;

export interface Stage {
  id: StageId;
  title: string;
  shortTitle: string;
}

export const STAGES: readonly Stage[] = [
  { id: 1, title: "Your role", shortTitle: "Role" },
  { id: 2, title: "Party details", shortTitle: "Parties" },
  { id: 3, title: "Court and cause of action", shortTitle: "Court" },
  { id: 4, title: "Case questions", shortTitle: "Questions" },
  { id: 5, title: "Financial and supporting details", shortTitle: "Financial" },
  { id: 6, title: "Review and preview", shortTitle: "Review" },
];

export interface Person {
  fullName: string;
  age: string;
  occupation: string;
  address: string;
  phone: string;
}

export type CourtType = "family-court" | "district-court" | "magistrate-court";

export interface CourtSelection {
  state: string;
  district: string;
  courtType: CourtType | "";
}

export type CauseOfActionId =
  | "interim-maintenance"
  | "permanent-alimony"
  | "child-maintenance"
  | "enforcement-of-order"
  | "modification-of-order";

export interface SupportingDocument {
  id: string;
  label: string;
  available: boolean;
}

export interface FinancialDetails {
  monthlyIncome: string;
  monthlyExpenses: string;
  dependants: string;
  otherIncomeNotes: string;
  documents: SupportingDocument[];
}

export interface FilingDraft {
  version: typeof DRAFT_VERSION;
  stage: StageId;
  role: Role | "";
  parties: { you: Person; other: Person };
  court: CourtSelection;
  causeOfAction: CauseOfActionId | "";
  answers: Record<string, string>;
  financial: FinancialDetails;
  updatedAt: string;
}

export type FieldErrors = Record<string, string>;

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  label: string;
  hint?: string;
  type: "text" | "textarea" | "select" | "yesno" | "number";
  required: boolean;
  options?: QuestionOption[];
  appliesTo?: Role[];
}