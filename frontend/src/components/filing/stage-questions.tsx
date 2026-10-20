import type { Dispatch } from "react";
import { CAUSES, getQuestions } from "@/lib/filing/data";
import type { FieldErrors, FilingDraft, Question } from "@/lib/filing/types";
import { FormField } from "./form-field";
import type { Action } from "./use-filing-draft";

function QuestionField({
  q,
  value,
  error,
  onChange,
}: {
  q: Question;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const invalid = error ? true : undefined;
  const required = q.required ? "true" : undefined;
  return (
    <FormField label={q.label} hint={q.hint} error={error} required={q.required}>
      {q.type === "textarea" ? (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-required={required}
        />
      ) : q.type === "select" || q.type === "yesno" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-required={required}
        >
          <option value="">Choose an answer</option>
          {(q.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          inputMode={q.type === "number" ? "decimal" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-required={required}
        />
      )}
    </FormField>
  );
}

export function StageQuestions({
  draft,
  errors,
  dispatch,
}: {
  draft: FilingDraft;
  errors: FieldErrors;
  dispatch: Dispatch<Action>;
}) {
  const cause = CAUSES.find((c) => c.id === draft.causeOfAction);
  if (!cause) {
    return (
      <p className="f-placeholder">
        Go back to the previous stage and choose the type of case first. The questions here depend
        on it.
      </p>
    );
  }
  const questions = getQuestions(draft.causeOfAction, draft.role);
  return (
    <fieldset className="f-fieldset">
      <legend>{cause.label}</legend>
      {questions.map((q) => (
        <QuestionField
          key={q.id}
          q={q}
          value={draft.answers[q.id] ?? ""}
          error={errors[`answers.${q.id}`]}
          onChange={(value) => dispatch({ type: "setAnswer", id: q.id, value })}
        />
      ))}
    </fieldset>
  );
}