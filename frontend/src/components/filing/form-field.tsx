import type { ReactNode } from "react";
import { Field } from "@/components/ui";

export function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const text = error ? `Error: ${error}` : hint;
  return (
    <div className="f-wrap" data-invalid={error ? "true" : undefined}>
      <Field label={required ? `${label} (required)` : label} hint={text}>
        {children}
      </Field>
    </div>
  );
}