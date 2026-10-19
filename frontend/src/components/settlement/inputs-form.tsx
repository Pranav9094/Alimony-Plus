"use client";

import { useState } from "react";
import {
  AMOUNT_FIELDS,
  LIMITS,
  OWNER_LABELS,
  OWNERS,
  emptyForm,
  parseSettlementForm,
  type FieldErrors,
  type Owner,
  type SettlementFormValues,
} from "@/lib/settlement/schemas";

interface InputsFormProps {
  initialValues?: SettlementFormValues;
  onChange?: (values: SettlementFormValues) => void;
  onValidChange?: (result: ReturnType<typeof parseSettlementForm>) => void;
}

type RowKind = "assets" | "debts";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="mt-1 text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

function InputField({
  id,
  label,
  value,
  error,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative mt-1">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-3 flex items-center text-sm text-slate-500"
        >
          ₹
        </span>

        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [hint ? hintId : "", error ? errorId : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={`block w-full rounded-lg border bg-white py-2.5 pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${
            error
              ? "border-red-400 focus:ring-red-100"
              : "border-slate-300 focus:border-teal-600 focus:ring-teal-100"
          }`}
        />
      </div>

      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function OwnerSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Owner;
  onChange: (value: Owner) => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        Ownership
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as Owner)}
        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
      >
        {OWNERS.map((owner) => (
          <option key={owner} value={owner}>
            {OWNER_LABELS[owner]}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function InputsForm({
  initialValues,
  onChange,
  onValidChange,
}: InputsFormProps) {
  const [values, setValues] = useState<SettlementFormValues>(
    () => initialValues ?? emptyForm(),
  );

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function updateValues(next: SettlementFormValues) {
    setValues(next);

    onChange?.(next);

    const result = parseSettlementForm(next);

    if (submitted) {
      setErrors(result.ok ? {} : result.errors);
    }

    onValidChange?.(result);
  }

  function updateAmount(
    field: (typeof AMOUNT_FIELDS)[number][0],
    value: string,
  ) {
    updateValues({
      ...values,
      [field]: value,
    });
  }

  function updateRow(
    kind: RowKind,
    index: number,
    patch: Partial<SettlementFormValues["assets"][number]>,
  ) {
    const rows = [...values[kind]];

    rows[index] = {
      ...rows[index],
      ...patch,
    };

    const next = {
      ...values,
      [kind]: rows,
    };

    updateValues(next);

    if (submitted) {
      const prefix = `${kind}.${index}.`;

      setErrors((previous) => {
        const filtered = Object.fromEntries(
          Object.entries(previous).filter(([key]) => !key.startsWith(prefix)),
        );

        return filtered;
      });
    }
  }

  function addRow(kind: RowKind) {
    if (values[kind].length >= LIMITS.maxRows) return;

    const row = {
      id: makeId(),
      label: "",
      owner: "joint" as Owner,
      value: "",
    };

    updateValues({
      ...values,
      [kind]: [...values[kind], row],
    });
  }

  function removeRow(kind: RowKind, index: number) {
    const removed = values[kind][index];

    const next = {
      ...values,
      [kind]: values[kind].filter((_, i) => i !== index),
    };

    updateValues(next);

    if (removed) {
      setErrors((previous) => {
        const updated: FieldErrors = {};

        for (const [key, message] of Object.entries(previous)) {
          if (!key.startsWith(`${kind}.`)) {
            updated[key] = message;
            continue;
          }

          const match = key.match(new RegExp(`^${kind}\\.(\\d+)(\\..+)$`));

          if (!match) {
            updated[key] = message;
            continue;
          }

          const rowIndex = Number(match[1]);
          const suffix = match[2];

          if (rowIndex < index) {
            updated[key] = message;
          } else if (rowIndex > index) {
            updated[`${kind}.${rowIndex - 1}${suffix}`] = message;
          }
        }

        return updated;
      });
    }
  }

  function validateForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    const result = parseSettlementForm(values);

    setErrors(result.ok ? {} : result.errors);
    onValidChange?.(result);

    if (!result.ok) {
      const firstInvalidField = Object.keys(result.errors)[0];

      if (firstInvalidField) {
        document.getElementById(firstInvalidField)?.focus();
      }

      return;
    }
  }

  function renderRows(kind: RowKind, title: string) {
    const rows = values[kind];

    return (
      <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>

            <p className="mt-1 text-sm text-slate-500">
              {rows.length} of {LIMITS.maxRows} entries
            </p>
          </div>

          <button
            type="button"
            onClick={() => addRow(kind)}
            disabled={rows.length >= LIMITS.maxRows}
            className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add {kind === "assets" ? "asset" : "debt"}
          </button>
        </div>

        {errors[kind] && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {errors[kind]}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            No {kind} added yet. Add an entry if applicable.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {kind === "assets" ? "Asset" : "Debt"} {index + 1}
                  </h4>

                  <button
                    type="button"
                    onClick={() => removeRow(kind, index)}
                    className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                    aria-label={`Remove ${kind === "assets" ? "asset" : "debt"} ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label
                      htmlFor={`${kind}.${index}.label`}
                      className="block text-sm font-medium text-slate-700"
                    >
                      Name
                    </label>

                    <input
                      id={`${kind}.${index}.label`}
                      value={row.label}
                      maxLength={LIMITS.labelMax}
                      onChange={(event) =>
                        updateRow(kind, index, {
                          label: event.target.value,
                        })
                      }
                      aria-invalid={Boolean(errors[`${kind}.${index}.label`])}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      placeholder={
                        kind === "assets"
                          ? "e.g. Family home"
                          : "e.g. Home loan"
                      }
                    />

                    <FieldError message={errors[`${kind}.${index}.label`]} />
                  </div>

                  <OwnerSelect
                    id={`${kind}.${index}.owner`}
                    value={row.owner}
                    onChange={(owner) => updateRow(kind, index, { owner })}
                  />

                  <div>
                    <label
                      htmlFor={`${kind}.${index}.value`}
                      className="block text-sm font-medium text-slate-700"
                    >
                      {kind === "assets" ? "Asset value" : "Debt balance"} (₹)
                    </label>

                    <input
                      id={`${kind}.${index}.value`}
                      inputMode="decimal"
                      value={row.value}
                      onChange={(event) =>
                        updateRow(kind, index, {
                          value: event.target.value,
                        })
                      }
                      aria-invalid={Boolean(errors[`${kind}.${index}.value`])}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      placeholder="0"
                    />

                    <FieldError message={errors[`${kind}.${index}.value`]} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={validateForm} noValidate className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            Financial information
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Enter monthly amounts in Indian rupees. Enter 0 only when the amount
            is genuinely zero.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {AMOUNT_FIELDS.map(([field, label]) => (
            <InputField
              key={field}
              id={field}
              label={label}
              value={values[field]}
              error={errors[field]}
              onChange={(value) => updateAmount(field, value)}
              hint={
                field.includes("Income") || field.includes("Expenses")
                  ? "Monthly amount in INR"
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      {renderRows("assets", "Assets")}
      {renderRows("debts", "Debts")}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          Validate financial inputs
        </button>

        <button
          type="button"
          onClick={() => {
            const next = emptyForm();

            setErrors({});
            setSubmitted(false);
            setValues(next);
            onChange?.(next);

            const result = parseSettlementForm(next);
            onValidChange?.(result);
          }}
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Reset form
        </button>
      </div>

      {submitted && Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Please correct the highlighted fields before continuing.
        </div>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Illustrative financial planning only. This form does not determine legal
        entitlement or predict a court outcome.
      </p>
    </form>
  );
}
