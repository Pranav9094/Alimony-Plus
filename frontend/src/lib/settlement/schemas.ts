import { z } from "zod";

export const OWNERS = ["applicant", "respondent", "joint"] as const;
export type Owner = (typeof OWNERS)[number];

export const OWNER_LABELS: Record<Owner, string> = {
  applicant: "You",
  respondent: "Other party",
  joint: "Joint",
};

export const LIMITS = {
  maxAmount: 10_000_000_000,
  maxRows: 20,
  labelMax: 60,
  scenarioLabelMax: 40,
  maxYears: 40,
  maxDiscountPct: 30,
} as const;

/** Single-value money fields, in the order they appear on the form. */
export const AMOUNT_FIELDS = [
  ["applicantIncome", "Your monthly income"],
  ["respondentIncome", "Other party’s monthly income"],
  ["applicantExpenses", "Your essential monthly expenses"],
  ["respondentExpenses", "Other party’s essential monthly expenses"],
  ["childCosts", "Monthly cost of children’s care and education"],
  ["applicantDebtPayments", "Your monthly debt payments"],
  ["respondentDebtPayments", "Other party’s monthly debt payments"],
] as const;
export type AmountField = (typeof AMOUNT_FIELDS)[number][0];

function cleanNumber(text: string): number {
  const stripped = text.replace(/[,\s₹]/g, "");
  return stripped === "" ? Number.NaN : Number(stripped);
}

/** Money typed as text (commas and the rupee sign are allowed) turned into a number. */
function amount() {
  return z
    .string()
    .refine(
      (v) => v.trim() !== "",
      "Enter an amount. Use 0 only if it is really zero.",
    )
    .refine((v) => Number.isFinite(cleanNumber(v)), "Enter a valid number.")
    .refine((v) => cleanNumber(v) >= 0, "The amount cannot be negative.")
    .refine(
      (v) => cleanNumber(v) <= LIMITS.maxAmount,
      "This amount is too large to model.",
    )
    .transform(cleanNumber);
}

function rowSchema(noun: "asset" | "debt") {
  return z.object({
    id: z.string().min(1),
    label: z
      .string()
      .trim()
      .min(1, `Name this ${noun}.`)
      .max(LIMITS.labelMax, `Use ${LIMITS.labelMax} characters or fewer.`),
    owner: z.enum(OWNERS),
    value: amount(),
  });
}

export const settlementFormSchema = z.object({
  applicantIncome: amount(),
  respondentIncome: amount(),
  applicantExpenses: amount(),
  respondentExpenses: amount(),
  childCosts: amount(),
  applicantDebtPayments: amount(),
  respondentDebtPayments: amount(),
  assets: z
    .array(rowSchema("asset"))
    .max(LIMITS.maxRows, `Add at most ${LIMITS.maxRows} assets.`),
  debts: z
    .array(rowSchema("debt"))
    .max(LIMITS.maxRows, `Add at most ${LIMITS.maxRows} debts.`),
});

/** What the form holds (text fields). */
export type SettlementFormValues = z.input<typeof settlementFormSchema>;
/** What the engine receives (numbers). */
export type SettlementInputs = z.output<typeof settlementFormSchema>;
export type Row = SettlementInputs["assets"][number];

export type FieldErrors = Record<string, string>;
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors };

/** One message per field, using paths such as "applicantIncome" or "assets.0.value". */
function collectErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

export function parseSettlementForm(
  form: SettlementFormValues,
): ParseResult<SettlementInputs> {
  const result = settlementFormSchema.safeParse(form);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, errors: collectErrors(result.error.issues) };
}

export function emptyForm(): SettlementFormValues {
  return {
    applicantIncome: "",
    respondentIncome: "",
    applicantExpenses: "",
    respondentExpenses: "",
    childCosts: "",
    applicantDebtPayments: "",
    respondentDebtPayments: "",
    assets: [],
    debts: [],
  };
}

/** Illustrative starting values so the studio is not empty on first open. */
export function sampleForm(): SettlementFormValues {
  return {
    applicantIncome: "8000",
    respondentIncome: "60000",
    applicantExpenses: "12000",
    respondentExpenses: "20000",
    childCosts: "5000",
    applicantDebtPayments: "0",
    respondentDebtPayments: "5000",
    assets: [
      { id: "asset-1", label: "Family home", owner: "joint", value: "4500000" },
      { id: "asset-2", label: "Savings", owner: "respondent", value: "600000" },
      { id: "asset-3", label: "Savings", owner: "applicant", value: "150000" },
      { id: "asset-4", label: "Car", owner: "respondent", value: "350000" },
    ],
    debts: [
      { id: "debt-1", label: "Home loan", owner: "joint", value: "1200000" },
      {
        id: "debt-2",
        label: "Personal loan",
        owner: "respondent",
        value: "150000",
      },
    ],
  };
}

export const POOL_SCOPES = ["joint-only", "all-assets"] as const;
export type PoolScope = (typeof POOL_SCOPES)[number];

export const scenarioSchema = z.object({
  id: z.string().min(1),
  label: z
    .string()
    .trim()
    .min(1, "Give the scenario a name.")
    .max(
      LIMITS.scenarioLabelMax,
      `Use ${LIMITS.scenarioLabelMax} characters or fewer.`,
    ),
  packId: z.string().min(1, "Choose a rule pack."),
  poolScope: z.enum(POOL_SCOPES),
  splitPctApplicant: z
    .number()
    .min(0, "Share cannot be below 0%.")
    .max(100, "Share cannot be above 100%."),
  monthlyAmount: z
    .number()
    .min(0, "Monthly amount cannot be negative.")
    .max(LIMITS.maxAmount, "This amount is too large to model."),
  years: z
    .number()
    .int("Use whole years.")
    .min(0, "Years cannot be negative.")
    .max(LIMITS.maxYears, `Use ${LIMITS.maxYears} years or fewer.`),
  discountRatePct: z
    .number()
    .min(0, "The rate cannot be negative.")
    .max(LIMITS.maxDiscountPct, `Use ${LIMITS.maxDiscountPct}% or less.`),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export function createScenario(
  id: string,
  label: string,
  overrides: Partial<Scenario> = {},
): Scenario {
  return {
    id,
    label,
    packId: "needs-gap",
    poolScope: "joint-only",
    splitPctApplicant: 50,
    monthlyAmount: 0,
    years: 5,
    discountRatePct: 6,
    ...overrides,
  };
}

export function parseScenario(value: unknown): ParseResult<Scenario> {
  const result = scenarioSchema.safeParse(value);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, errors: collectErrors(result.error.issues) };
}