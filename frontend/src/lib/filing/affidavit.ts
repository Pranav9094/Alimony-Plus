import { CAUSES, COURT_TYPES, getQuestions } from "./data";
import type { FilingDraft } from "./types";

export interface AffidavitSection {
  heading: string;
  paragraphs: string[];
}

export const DRAFT_NOTICE =
  "Draft prepared with the Alimony+ draft helper. It is not legal advice. Have a lawyer check it before it is signed or filed.";

const BLANK = "[to be filled]";

function v(value: string): string {
  return value.trim() === "" ? BLANK : value.trim();
}

function rupees(value: string): string {
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n)) return BLANK;
  return `Rs. ${n.toLocaleString("en-IN")}`;
}

export function buildAffidavit(draft: FilingDraft): AffidavitSection[] {
  const { you, other } = draft.parties;
  const roleWord =
    draft.role === "petitioner"
      ? "Petitioner"
      : draft.role === "respondent"
        ? "Respondent"
        : "Party";
  const otherWord =
    draft.role === "petitioner"
      ? "Respondent"
      : draft.role === "respondent"
        ? "Petitioner"
        : "Other party";
  const courtLabel =
    COURT_TYPES.find((c) => c.value === draft.court.courtType)?.label ?? BLANK;
  const cause = CAUSES.find((c) => c.id === draft.causeOfAction)?.label ?? BLANK;

  const questionLines = getQuestions(draft.causeOfAction, draft.role).map((q) => {
    const raw = (draft.answers[q.id] ?? "").trim();
    const shown =
      q.options?.find((o) => o.value === raw)?.label ?? (raw === "" ? BLANK : raw);
    return `${q.label} ${shown}`;
  });

  const available = draft.financial.documents.filter((d) => d.available);
  const documentLine =
    available.length > 0
      ? `The following documents are available: ${available.map((d) => d.label).join("; ")}.`
      : "No supporting documents have been marked as available yet.";

  return [
    {
      heading: "Title",
      paragraphs: [
        `IN THE ${courtLabel.toUpperCase()} AT ${v(draft.court.district).toUpperCase()}, ${v(draft.court.state).toUpperCase()}`,
        `${v(you.fullName)} (${roleWord}) versus ${v(other.fullName)} (${otherWord})`,
        "AFFIDAVIT",
      ],
    },
    {
      heading: "Deponent",
      paragraphs: [
        `I, ${v(you.fullName)}, aged ${v(you.age)} years, occupation ${v(you.occupation)}, residing at ${v(you.address)}, the ${roleWord} in this matter, do solemnly affirm and state as follows:`,
      ],
    },
    {
      heading: "Parties",
      paragraphs: [
        `1. The ${otherWord} is ${v(other.fullName)}, occupation ${v(other.occupation)}, residing at ${v(other.address)}.`,
      ],
    },
    {
      heading: "Nature of the case",
      paragraphs: [`2. This affidavit is made in a matter concerning: ${cause}.`],
    },
    {
      heading: "Facts",
      paragraphs: questionLines.length > 0 ? questionLines.map((l, i) => `${3 + i}. ${l}`) : [`3. ${BLANK}`],
    },
    {
      heading: "Financial details",
      paragraphs: [
        `My monthly income is ${rupees(draft.financial.monthlyIncome)} and my monthly expenses are ${rupees(draft.financial.monthlyExpenses)}.`,
        `Number of persons who depend on me: ${v(draft.financial.dependants)}.`,
        draft.financial.otherIncomeNotes.trim() !== ""
          ? `Other income and notes: ${draft.financial.otherIncomeNotes.trim()}`
          : "No other income has been noted.",
        documentLine,
      ],
    },
    {
      heading: "Verification",
      paragraphs: [
        "I, the deponent, verify that the contents above are true and correct to the best of my knowledge and belief, and that nothing material has been concealed.",
        "Place: ____________    Date: ____________",
        "Signature of the deponent: ____________",
      ],
    },
  ];
}