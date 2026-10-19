import type { Dispatch } from "react";
import type { FieldErrors, FinancialDetails } from "@/lib/filing/types";
import { FormField } from "./form-field";
import type { Action } from "./use-filing-draft";

export function StageFinancial({
  financial,
  errors,
  dispatch,
}: {
  financial: FinancialDetails;
  errors: FieldErrors;
  dispatch: Dispatch<Action>;
}) {
  const bad = (key: string) => (errors[`financial.${key}`] ? true : undefined);
  return (
    <>
      <fieldset className="f-fieldset">
        <legend>Income and expenses</legend>
        <FormField
          label="Monthly income (in rupees)"
          required
          hint="Enter 0 if you have no income."
          error={errors["financial.monthlyIncome"]}
        >
          <input
            type="text"
            inputMode="decimal"
            value={financial.monthlyIncome}
            onChange={(e) =>
              dispatch({ type: "setFinancial", patch: { monthlyIncome: e.target.value } })
            }
            aria-invalid={bad("monthlyIncome")}
            aria-required="true"
          />
        </FormField>
        <FormField
          label="Monthly expenses (in rupees)"
          required
          error={errors["financial.monthlyExpenses"]}
        >
          <input
            type="text"
            inputMode="decimal"
            value={financial.monthlyExpenses}
            onChange={(e) =>
              dispatch({ type: "setFinancial", patch: { monthlyExpenses: e.target.value } })
            }
            aria-invalid={bad("monthlyExpenses")}
            aria-required="true"
          />
        </FormField>
        <FormField
          label="Number of dependants"
          required
          hint="People who depend on you financially. A whole number."
          error={errors["financial.dependants"]}
        >
          <input
            type="text"
            inputMode="numeric"
            value={financial.dependants}
            onChange={(e) =>
              dispatch({ type: "setFinancial", patch: { dependants: e.target.value } })
            }
            aria-invalid={bad("dependants")}
            aria-required="true"
          />
        </FormField>
        <FormField label="Other income or notes" hint="Optional.">
          <textarea
            rows={3}
            value={financial.otherIncomeNotes}
            onChange={(e) =>
              dispatch({ type: "setFinancial", patch: { otherIncomeNotes: e.target.value } })
            }
          />
        </FormField>
      </fieldset>

      <fieldset className="f-fieldset">
        <legend>Supporting documents</legend>
        <p className="f-hint">
          Tick the documents you already have. This only records what is available. Nothing is
          uploaded here.
        </p>
        <div className="f-checks">
          {financial.documents.map((d) => (
            <label key={d.id} className="f-check">
              <input
                type="checkbox"
                checked={d.available}
                onChange={() => dispatch({ type: "toggleDocument", id: d.id })}
              />
              <span>{d.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}