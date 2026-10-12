import type { Citation } from "./types";

// SAMPLE DATA ONLY. Fictional parties, not real judgments.
// Replace with the backend/AI citation source once the contract exists.
export const SAMPLE_CITATIONS: Citation[] = [
  {
    id: "c1",
    title: "Asha Rao v. Vikram Rao (Sample)",
    court: "Sample High Court",
    bench: ["Hon'ble Justice A. Example"],
    date: "2020-11-04",
    summary:
      "Illustrative record showing how a judgment summary appears in the preview card.",
    holding:
      "Sample holding: both parties should disclose income and assets so interim maintenance can be assessed fairly.",
    sample: true,
  },
  {
    id: "c2",
    title: "Meena Iyer v. Karan Iyer (Sample)",
    court: "Sample District Court",
    bench: ["Hon'ble Judge B. Example"],
    date: "2018-03-12",
    summary:
      "Illustrative record about maintenance proceedings being decided in a summary manner.",
    holding:
      "Sample holding: maintenance proceedings are meant to give timely relief, not to settle every civil dispute.",
    sample: true,
  },
  {
    id: "c3",
    title: "Farah Khan v. Imran Khan (Sample)",
    court: "Sample High Court",
    bench: ["Hon'ble Justice C. Example", "Hon'ble Justice D. Example"],
    date: "2022-07-19",
    summary:
      "Illustrative record showing a two-judge bench in the preview card.",
    holding:
      "Sample holding: maintenance is generally considered from the date the application is filed.",
    sample: true,
  },
];

export function getCitation(id: string): Citation | undefined {
  return SAMPLE_CITATIONS.find((c) => c.id === id);
}

const MAINTENANCE = `**Interim maintenance under Sec 125 CrPC (now Sec 144 BNSS)**

Sec 125 CrPC lets a Magistrate order a monthly allowance for a wife, children or parents who cannot maintain themselves. Since 1 July 2024 the same provision is in Sec 144 of the BNSS. [[cite:c2]]

Courts usually look at these factors:

| Factor | What is considered |
| --- | --- |
| Income | Salary, business income and other earnings of both parties |
| Needs | Housing, food, education and medical needs of the applicant and children |
| Liabilities | Existing loans and other dependants |

Disclosure of income and assets by both sides helps the court decide fairly. [[cite:c1]] Maintenance is generally counted from the date of the application. [[cite:c3]]

Example wording to keep in your notes:

\`\`\`text
The applicant seeks interim maintenance from the date of filing of this application.
\`\`\`

This is general information only. A lawyer can tell you what applies to your case.`;

const DISCLOSURE = `**Affidavit of income and assets**

Many family courts ask both parties to file a sworn statement of income, assets and liabilities. [[cite:c1]]

1. List all income sources with proof
2. List assets and liabilities
3. Keep supporting documents ready: bank statements, tax returns, salary slips
4. Check every figure before signing

Incomplete or incorrect disclosure can hurt your case, so accuracy matters.`;

const DEFAULT = `I can help you understand maintenance and alimony in India in plain language.

You can ask about:

- Interim maintenance and how courts approach it [[cite:c2]]
- Documents to keep ready for a hearing
- How a maintenance order is enforced

This is general information, not legal advice.`;

export function buildAnswer(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/(125|144|interim|maintenance|calculate)/.test(p)) return MAINTENANCE;
  if (/(affidavit|disclosure|document|asset)/.test(p)) return DISCLOSURE;
  return DEFAULT;
}