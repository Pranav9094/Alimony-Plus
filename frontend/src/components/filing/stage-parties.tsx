import type { ChangeEvent, Dispatch } from "react";
import type { FieldErrors, Person } from "@/lib/filing/types";
import { FormField } from "./form-field";
import type { Action } from "./use-filing-draft";

function PersonFields({
  who,
  person,
  errors,
  dispatch,
}: {
  who: "you" | "other";
  person: Person;
  errors: FieldErrors;
  dispatch: Dispatch<Action>;
}) {
  const mine = who === "you";
  const set =
    (field: keyof Person) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      dispatch({ type: "setPerson", who, field, value: e.target.value });
  const err = (key: string) => errors[`${who}.${key}`];
  const bad = (key: string) => (errors[`${who}.${key}`] ? true : undefined);

  return (
    <>
      <FormField label="Full name" required error={err("fullName")}>
        <input
          type="text"
          value={person.fullName}
          onChange={set("fullName")}
          autoComplete={mine ? "name" : "off"}
          aria-invalid={bad("fullName")}
          aria-required="true"
        />
      </FormField>
      <FormField
        label="Age"
        required={mine}
        hint={mine ? "A whole number, 18 or above." : "Optional."}
        error={err("age")}
      >
        <input
          type="text"
          inputMode="numeric"
          value={person.age}
          onChange={set("age")}
          autoComplete="off"
          aria-invalid={bad("age")}
          aria-required={mine ? "true" : undefined}
        />
      </FormField>
      <FormField label="Occupation" hint="Optional.">
        <input
          type="text"
          value={person.occupation}
          onChange={set("occupation")}
          autoComplete="off"
        />
      </FormField>
      <FormField label="Address" required={mine} hint={mine ? undefined : "Optional."} error={err("address")}>
        <textarea
          rows={3}
          value={person.address}
          onChange={set("address")}
          autoComplete={mine ? "street-address" : "off"}
          aria-invalid={bad("address")}
          aria-required={mine ? "true" : undefined}
        />
      </FormField>
      <FormField label="Phone number" hint="Optional." error={err("phone")}>
        <input
          type="tel"
          value={person.phone}
          onChange={set("phone")}
          autoComplete={mine ? "tel" : "off"}
          aria-invalid={bad("phone")}
        />
      </FormField>
    </>
  );
}

export function StageParties({
  parties,
  errors,
  dispatch,
}: {
  parties: { you: Person; other: Person };
  errors: FieldErrors;
  dispatch: Dispatch<Action>;
}) {
  return (
    <>
      <fieldset className="f-fieldset">
        <legend>About you</legend>
        <PersonFields who="you" person={parties.you} errors={errors} dispatch={dispatch} />
      </fieldset>
      <fieldset className="f-fieldset">
        <legend>About the other party</legend>
        <PersonFields who="other" person={parties.other} errors={errors} dispatch={dispatch} />
      </fieldset>
    </>
  );
}