"use client";

import { CAUSES, COURT_TYPES, getQuestions } from "@/lib/filing/data";
import { STAGES } from "@/lib/filing/types";
import type { FilingDraft, StageId } from "@/lib/filing/types";
import { firstInvalidStage } from "@/lib/filing/validation";

function money(value: string): string {
  const n = Number(value);
  return value.trim() === "" || !Number.isFinite(n)
    ? "not filled"
    : `Rs. ${n.toLocaleString("en-IN")}`;
}

export function StageReview({
  draft,
  onEdit,
}: {
  draft: FilingDraft;
  onEdit: (stage: StageId) => void;
}) {
  const problem = firstInvalidStage(draft);
  const questions = getQuestions(draft.causeOfAction, draft.role);
  const answered = questions.filter((q) => (draft.answers[q.id] ?? "").trim() !== "").length;
  const place = [draft.court.district, draft.court.state].filter(Boolean).join(", ");
  const courtType = COURT_TYPES.find((c) => c.value === draft.court.courtType)?.label;
  const cause = CAUSES.find((c) => c.id === draft.causeOfAction)?.label;

  const rows: { stage: StageId; label: string; value: string }[] = [
    {
      stage: 1,
      label: "Your role",
      value:
        draft.role === ""
          ? "Not chosen"
          : draft.role === "petitioner"
            ? "Petitioner"
            : "Respondent",
    },
    { stage: 2, label: "You", value: draft.parties.you.fullName || "Not filled" },
    { stage: 2, label: "Other party", value: draft.parties.other.fullName || "Not filled" },
    {
      stage: 3,
      label: "Court",
      value: place === "" ? "Not chosen" : `${courtType ?? "Court type not chosen"}, ${place}`,
    },
    { stage: 3, label: "Type of case", value: cause ?? "Not chosen" },
    {
      stage: 4,
      label: "Case questions",
      value: `${answered} of ${questions.length} answered`,
    },
    {
      stage: 5,
      label: "Income and expenses",
      value: `Income ${money(draft.financial.monthlyIncome)}, expenses ${money(draft.financial.monthlyExpenses)}`,
    },
  ];

  return (
    <div>
      {problem ? (
        <div className="f-summary" role="status">
          Stage {problem} ({STAGES.find((s) => s.id === problem)?.title}) still has missing or
          invalid details.{" "}
          <button type="button" className="f-link-btn" onClick={() => onEdit(problem)}>
            Go to that stage
          </button>
        </div>
      ) : (
        <p className="f-ok" role="status">
          All required details are filled in. Check the preview, then print or save as PDF.
        </p>
      )}

      <dl className="f-review">
        {rows.map((r) => (
          <div key={r.label} className="f-review-row">
            <div>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
            <button
              type="button"
              className="f-link-btn"
              onClick={() => onEdit(r.stage)}
              aria-label={`Change ${r.label}`}
            >
              Change
            </button>
          </div>
        ))}
      </dl>

      <div className="f-nav">
        <button
          type="button"
          className="f-btn f-btn-primary"
          onClick={() => window.print()}
          disabled={problem !== null}
        >
          Print / Save as PDF
        </button>
      </div>
      <p className="f-hint">
        This is a draft helper, not legal advice. Have a lawyer check the affidavit before it is
        signed or filed.
      </p>
    </div>
  );
}