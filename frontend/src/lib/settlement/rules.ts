import { clamp, roundMoney } from "./finance";
import type { SettlementInputs } from "./schemas";

export const RULE_DISCLAIMER =
  "Illustrative planning heuristics only. India has no fixed formula for maintenance: a court decides each case on its facts. These packs show how a number is reached, not what a court will order.";

export type RuleParam = {
  id: string;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

export type RuleStep = {
  label: string;
  value: number;
  kind: "money" | "percent";
  note?: string;
};

export type RuleOutcome = {
  monthly: number;
  steps: RuleStep[];
  warnings: string[];
};

export type RulePack = {
  id: string;
  name: string;
  summary: string;
  params: RuleParam[];
  /** Always false here: nobody has checked these heuristics against a statute or order. */
  verified: false;
  compute: (
    inputs: SettlementInputs,
    params: Record<string, number>,
  ) => RuleOutcome;
};

export type Reference = { title: string; note: string };

export type JurisdictionProfile = {
  id: string;
  name: string;
  description: string;
  references: Reference[];
  packIds: string[];
  /** pack id -> param id -> value */
  paramOverrides: Record<string, Record<string, number>>;
  verified: false;
};

const money = (label: string, value: number, note?: string): RuleStep => ({
  label,
  value: roundMoney(value),
  kind: "money",
  note,
});
const percent = (label: string, value: number, note?: string): RuleStep => ({
  label,
  value,
  kind: "percent",
  note,
});

function needGap(i: SettlementInputs): number {
  return Math.max(
    0,
    i.applicantExpenses +
      i.childCosts +
      i.applicantDebtPayments -
      i.applicantIncome,
  );
}

function capacity(i: SettlementInputs): number {
  return Math.max(
    0,
    i.respondentIncome - i.respondentExpenses - i.respondentDebtPayments,
  );
}

function commonWarnings(i: SettlementInputs, cap: number): string[] {
  const warnings: string[] = [];
  if (i.applicantIncome === 0 && i.respondentIncome === 0)
    warnings.push("No income is entered for either party, so results are zero.");
  else if (cap === 0)
    warnings.push(
      "The other party has no surplus after expenses and debt payments, so the amount is capped at zero.",
    );
  return warnings;
}

const CHILDREN_NOTE = "Assumes the children live with you.";

const needsGap: RulePack = {
  id: "needs-gap",
  name: "Need gap vs capacity",
  summary:
    "Covers the gap between your needs and your income, limited by what the other party can spare.",
  params: [
    {
      id: "coveragePct",
      label: "Share of your need gap to cover",
      help: "100% covers the whole gap. Above 100% is a stress case.",
      min: 0,
      max: 150,
      step: 5,
      default: 100,
    },
  ],
  verified: false,
  compute(i, p) {
    const need = needGap(i);
    const cap = capacity(i);
    const coverage = clamp(p.coveragePct ?? 100, 0, 150);
    const target = (need * coverage) / 100;
    const monthly = Math.min(target, cap);
    const warnings = commonWarnings(i, cap);
    if (need === 0 && i.applicantIncome > 0)
      warnings.push("Your income already covers your listed needs.");
    if (i.childCosts > 0) warnings.push(CHILDREN_NOTE);
    return {
      monthly: roundMoney(monthly),
      steps: [
        money(
          "Your need gap",
          need,
          "Expenses + children’s costs + debt payments − your income",
        ),
        percent("Share of the gap covered", coverage),
        money("Target amount", target),
        money(
          "Other party’s capacity",
          cap,
          "Income − expenses − debt payments",
        ),
        money("Monthly amount", monthly, "Lower of target and capacity"),
      ],
      warnings,
    };
  },
};

const incomeEqualisation: RulePack = {
  id: "income-equalisation",
  name: "Income equalisation",
  summary:
    "Moves your income up to a chosen share of the combined income, limited by what the other party can spare.",
  params: [
    {
      id: "targetSharePct",
      label: "Your target share of combined income",
      help: "50% aims for equal incomes.",
      min: 0,
      max: 100,
      step: 5,
      default: 50,
    },
  ],
  verified: false,
  compute(i, p) {
    const share = clamp(p.targetSharePct ?? 50, 0, 100);
    const combined = i.applicantIncome + i.respondentIncome;
    const target = (combined * share) / 100;
    const gap = Math.max(0, target - i.applicantIncome);
    const cap = capacity(i);
    const monthly = Math.min(gap, cap);
    return {
      monthly: roundMoney(monthly),
      steps: [
        money("Combined income", combined),
        percent("Your target share", share),
        money("Your target income", target),
        money("Gap to target", gap, "Target income − your income"),
        money(
          "Other party’s capacity",
          cap,
          "Income − expenses − debt payments",
        ),
        money("Monthly amount", monthly, "Lower of the gap and capacity"),
      ],
      warnings: commonWarnings(i, cap),
    };
  },
};

const disposableEqualisation: RulePack = {
  id: "disposable-equalisation",
  name: "Disposable income sharing",
  summary:
    "Shares what is left after essential costs and debt payments, so both households end up with a chosen share.",
  params: [
    {
      id: "targetSharePct",
      label: "Your target share of combined disposable income",
      help: "50% aims for equal money left after essentials.",
      min: 0,
      max: 100,
      step: 5,
      default: 50,
    },
  ],
  verified: false,
  compute(i, p) {
    const share = clamp(p.targetSharePct ?? 50, 0, 100);
    const yours =
      i.applicantIncome -
      i.applicantExpenses -
      i.childCosts -
      i.applicantDebtPayments;
    const theirs =
      i.respondentIncome - i.respondentExpenses - i.respondentDebtPayments;
    const pool = yours + theirs;
    const target = (pool * share) / 100;
    const transfer = target - yours;
    const cap = Math.max(0, theirs);
    const monthly = Math.max(0, Math.min(transfer, cap));
    const warnings = commonWarnings(i, capacity(i));
    if (pool < 0)
      warnings.push(
        "Combined finances run at a deficit. No transfer can close the gap.",
      );
    if (i.childCosts > 0) warnings.push(CHILDREN_NOTE);
    return {
      monthly: roundMoney(monthly),
      steps: [
        money(
          "Your disposable income",
          yours,
          "Income − expenses − children’s costs − debt payments",
        ),
        money(
          "Other party’s disposable income",
          theirs,
          "Income − expenses − debt payments",
        ),
        money("Combined disposable income", pool),
        percent("Your target share", share),
        money("Your target amount", target),
        money("Transfer needed", transfer, "Target amount − your disposable"),
        money("Monthly amount", monthly, "Capped at what the other party has left"),
      ],
      warnings,
    };
  },
};

const manual: RulePack = {
  id: "manual",
  name: "Manual amount",
  summary: "No calculation. You choose the monthly amount with the slider.",
  params: [],
  verified: false,
  compute(i) {
    return {
      monthly: 0,
      steps: [money("Monthly amount", 0, "Set the amount with the slider")],
      warnings: commonWarnings(i, capacity(i)),
    };
  },
};

export const RULE_PACKS: readonly RulePack[] = [
  needsGap,
  incomeEqualisation,
  disposableEqualisation,
  manual,
];
export const DEFAULT_PACK_ID = needsGap.id;

const ALL_PACK_IDS = RULE_PACKS.map((p) => p.id);

export const JURISDICTIONS: readonly JurisdictionProfile[] = [
  {
    id: "central",
    name: "Central statutes (reference)",
    description:
      "Lists the main central laws and one Supreme Court decision that often come up. The packs below are generic heuristics, not formulas from these laws.",
    references: [
      {
        title: "Bharatiya Nagarik Suraksha Sanhita, 2023, section 144",
        note: "Maintenance for wives, children and parents (earlier CrPC section 125).",
      },
      {
        title: "Hindu Marriage Act, 1955, sections 24 and 25",
        note: "Interim and permanent maintenance between spouses.",
      },
      {
        title:
          "Protection of Women from Domestic Violence Act, 2005, section 20",
        note: "Monetary relief.",
      },
      {
        title: "Special Marriage Act, 1954, sections 36 and 37",
        note: "Alimony during proceedings and permanent alimony.",
      },
      {
        title: "Muslim Women (Protection of Rights on Divorce) Act, 1986",
        note: "Provision for divorced Muslim women.",
      },
      {
        title: "Rajnesh v. Neha (Supreme Court, 2020)",
        note: "Both parties file a disclosure affidavit of income and assets.",
      },
    ],
    packIds: ALL_PACK_IDS,
    paramOverrides: {},
    verified: false,
  },
  {
    id: "custom",
    name: "Custom state or court practice",
    description:
      "State rules and court practice differ and change over time. Set the parameters your lawyer advises. Nothing here is stated as a rule of any state.",
    references: [],
    packIds: ALL_PACK_IDS,
    paramOverrides: {},
    verified: false,
  },
];
export const DEFAULT_JURISDICTION_ID = "central";

export function getPack(id: string): RulePack | undefined {
  return RULE_PACKS.find((p) => p.id === id);
}

export function getJurisdiction(id: string): JurisdictionProfile | undefined {
  return JURISDICTIONS.find((j) => j.id === id);
}

/** Parameter values: user edit, else profile override, else default, always within range. */
export function resolveParams(
  pack: RulePack,
  profile?: JurisdictionProfile,
  userOverrides: Record<string, number> = {},
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const param of pack.params) {
    const raw =
      userOverrides[param.id] ??
      profile?.paramOverrides[pack.id]?.[param.id] ??
      param.default;
    out[param.id] = clamp(
      Number.isFinite(raw) ? raw : param.default,
      param.min,
      param.max,
    );
  }
  return out;
}

export function runRulePack(
  pack: RulePack,
  inputs: SettlementInputs,
  params: Record<string, number>,
): RuleOutcome {
  return pack.compute(inputs, params);
}