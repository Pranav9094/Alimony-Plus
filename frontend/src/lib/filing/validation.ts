import { SAMPLE_COURTS, getQuestions } from "./data";
import type { FieldErrors, FilingDraft, Person, StageId } from "./types";

const PHONE = /^\+?[0-9\s-]{7,15}$/;

function isNonNegative(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function checkPerson(
  prefix: "you" | "other",
  person: Person,
  errors: FieldErrors,
): void {
  const who = prefix === "you" ? "your" : "the other party's";
  if (!person.fullName.trim()) {
    errors[`${prefix}.fullName`] = `Enter ${who} full name.`;
  }
  if (prefix === "you") {
    const age = Number(person.age);
    if (!Number.isInteger(age) || age < 18 || age > 120) {
      errors["you.age"] = "Enter your age as a whole number from 18 to 120.";
    }
    if (!person.address.trim()) {
      errors["you.address"] = "Enter your address.";
    }
  } else if (person.age.trim() !== "") {
    const age = Number(person.age);
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      errors["other.age"] = "Enter a whole number from 1 to 120, or leave it empty.";
    }
  }
  if (person.phone.trim() !== "" && !PHONE.test(person.phone.trim())) {
    errors[`${prefix}.phone`] = "Enter a phone number with 7 to 15 digits, or leave it empty.";
  }
}

export function validateStage(draft: FilingDraft, stage: StageId): FieldErrors {
  const errors: FieldErrors = {};

  if (stage === 1) {
    if (draft.role === "") errors.role = "Choose whether you are the petitioner or the respondent.";
  }

  if (stage === 2) {
    checkPerson("you", draft.parties.you, errors);
    checkPerson("other", draft.parties.other, errors);
  }

  if (stage === 3) {
    const { state, district, courtType } = draft.court;
    if (!state) errors["court.state"] = "Choose a state.";
    if (!district) {
      errors["court.district"] = "Choose a district.";
    } else if (state && !(SAMPLE_COURTS[state] ?? []).includes(district)) {
      errors["court.district"] = "Choose a district that belongs to the selected state.";
    }
    if (!courtType) errors["court.courtType"] = "Choose a court type.";
    if (!draft.causeOfAction) errors.causeOfAction = "Choose the type of case.";
  }

  if (stage === 4) {
    for (const q of getQuestions(draft.causeOfAction, draft.role)) {
      const answer = (draft.answers[q.id] ?? "").trim();
      if (q.required && answer === "") {
        errors[`answers.${q.id}`] = "This question needs an answer.";
      } else if (q.type === "number" && answer !== "" && !isNonNegative(answer)) {
        errors[`answers.${q.id}`] = "Enter a number that is 0 or more.";
      }
    }
  }

  if (stage === 5) {
    const f = draft.financial;
    if (!isNonNegative(f.monthlyIncome)) {
      errors["financial.monthlyIncome"] = "Enter your monthly income in rupees (0 or more).";
    }
    if (!isNonNegative(f.monthlyExpenses)) {
      errors["financial.monthlyExpenses"] = "Enter your monthly expenses in rupees (0 or more).";
    }
    if (!isNonNegative(f.dependants) || !Number.isInteger(Number(f.dependants))) {
      errors["financial.dependants"] = "Enter the number of dependants as a whole number.";
    }
  }

  return errors;
}

export function isStageValid(draft: FilingDraft, stage: StageId): boolean {
  return Object.keys(validateStage(draft, stage)).length === 0;
}

export function firstInvalidStage(draft: FilingDraft): StageId | null {
  const stages: StageId[] = [1, 2, 3, 4, 5];
  for (const s of stages) {
    if (!isStageValid(draft, s)) return s;
  }
  return null;
}