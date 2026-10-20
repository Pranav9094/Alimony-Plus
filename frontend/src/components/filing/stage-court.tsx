import type { Dispatch } from "react";
import { CAUSES, COURT_TYPES, SAMPLE_COURTS, SAMPLE_NOTICE } from "@/lib/filing/data";
import type { CauseOfActionId, CourtSelection, CourtType, FieldErrors } from "@/lib/filing/types";
import { FormField } from "./form-field";
import type { Action } from "./use-filing-draft";

export function StageCourt({
  court,
  causeOfAction,
  errors,
  dispatch,
}: {
  court: CourtSelection;
  causeOfAction: CauseOfActionId | "";
  errors: FieldErrors;
  dispatch: Dispatch<Action>;
}) {
  const districts = court.state ? (SAMPLE_COURTS[court.state] ?? []) : [];
  return (
    <>
      <p className="f-hint">{SAMPLE_NOTICE}</p>
      <fieldset className="f-fieldset">
        <legend>Court</legend>
        <FormField label="State" required error={errors["court.state"]}>
          <select
            value={court.state}
            onChange={(e) =>
              dispatch({ type: "setCourt", patch: { state: e.target.value, district: "" } })
            }
            aria-invalid={errors["court.state"] ? true : undefined}
            aria-required="true"
          >
            <option value="">Choose a state</option>
            {Object.keys(SAMPLE_COURTS).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="District"
          required
          hint={court.state ? undefined : "Choose a state first."}
          error={errors["court.district"]}
        >
          <select
            value={court.district}
            onChange={(e) => dispatch({ type: "setCourt", patch: { district: e.target.value } })}
            disabled={!court.state}
            aria-invalid={errors["court.district"] ? true : undefined}
            aria-required="true"
          >
            <option value="">Choose a district</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Court type" required error={errors["court.courtType"]}>
          <select
            value={court.courtType}
            onChange={(e) =>
              dispatch({ type: "setCourt", patch: { courtType: e.target.value as CourtType | "" } })
            }
            aria-invalid={errors["court.courtType"] ? true : undefined}
            aria-required="true"
          >
            <option value="">Choose a court type</option>
            {COURT_TYPES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
      </fieldset>

      <fieldset
        className="f-fieldset"
        aria-describedby={errors.causeOfAction ? "cause-error" : undefined}
      >
        <legend>Type of case (required)</legend>
        <div className="f-choices">
          {CAUSES.map((c) => (
            <label key={c.id} className="f-choice">
              <input
                type="radio"
                name="cause"
                value={c.id}
                checked={causeOfAction === c.id}
                onChange={() => dispatch({ type: "setCause", cause: c.id })}
              />
              <span>
                <strong>{c.label}</strong>
                <span className="f-choice-text">{c.description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.causeOfAction ? (
          <p id="cause-error" className="f-error" role="alert">
            Error: {errors.causeOfAction}
          </p>
        ) : null}
      </fieldset>
    </>
  );
}