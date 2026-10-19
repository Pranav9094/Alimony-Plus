import { describe, expect, it } from "vitest";
import {
  clamp,
  cumulativeSeries,
  formatInr,
  formatInrCompact,
  nominalTotal,
  percentOf,
  presentValue,
  roundMoney,
  splitTotal,
} from "../src/lib/settlement/finance";
import {
  JURISDICTIONS,
  RULE_PACKS,
  getJurisdiction,
  getPack,
  resolveParams,
  runRulePack,
} from "../src/lib/settlement/rules";
import {
  compareScenarios,
  distribute,
  runScenario,
  type EngineSettings,
} from "../src/lib/settlement/engine";
import {
  createScenario,
  parseSettlementForm,
  sampleForm,
  type SettlementInputs,
} from "../src/lib/settlement/schemas";

function sampleInputs(): SettlementInputs {
  const parsed = parseSettlementForm(sampleForm());
  if (!parsed.ok) throw new Error("sample form must be valid");
  return parsed.data;
}

/** Small seeded random generator so the property checks are repeatable. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Slow but obvious: add up every monthly payment discounted one by one. */
function bruteForcePresentValue(monthly: number, years: number, annual: number) {
  const r = Math.pow(1 + annual / 100, 1 / 12) - 1;
  let total = 0;
  for (let k = 1; k <= Math.round(years * 12); k++)
    total += monthly / Math.pow(1 + r, k);
  return total;
}

describe("finance maths", () => {
  it("rounds to paise and clamps", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(percentOf(25, 200)).toBe(12.5);
    expect(percentOf(5, 0)).toBe(0);
  });

  it("splits a total without losing a paisa", () => {
    const next = random(7);
    for (let i = 0; i < 300; i++) {
      const total = roundMoney(next() * 50_000_000);
      const pct = Math.round(next() * 10000) / 100;
      const [first, second] = splitTotal(total, pct);
      expect(roundMoney(first + second)).toBe(total);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(second).toBeGreaterThanOrEqual(0);
    }
    expect(splitTotal(1000, 100)).toEqual([1000, 0]);
    expect(splitTotal(1000, 0)).toEqual([0, 1000]);
    expect(splitTotal(1000, 150)).toEqual([1000, 0]);
    expect(splitTotal(100001, 33.33)).toEqual([33330.33, 66670.67]);
  });

  it("matches a payment-by-payment calculation of present value", () => {
    const cases: Array<[number, number, number]> = [
      [10000, 5, 6],
      [25000.5, 12, 8.25],
      [1234.56, 1, 30],
      [99999, 40, 0.5],
      [500, 3, 12],
    ];
    for (const [monthly, years, rate] of cases)
      expect(presentValue(monthly, years, rate)).toBeCloseTo(
        bruteForcePresentValue(monthly, years, rate),
        2,
      );
    expect(presentValue(10000, 5, 6)).toBe(519238.22);
  });

  it("handles zero rate, zero years and zero payment", () => {
    expect(presentValue(7000, 30, 0)).toBe(2_520_000);
    expect(presentValue(10000, 0, 6)).toBe(0);
    expect(presentValue(0, 10, 6)).toBe(0);
    expect(nominalTotal(9000, 5)).toBe(540000);
  });

  it("is never above the plain total and falls as the rate rises", () => {
    let previous = Infinity;
    for (const rate of [0, 2, 4, 6, 10, 20, 30]) {
      const pv = presentValue(15000, 10, rate);
      expect(pv).toBeLessThanOrEqual(nominalTotal(15000, 10));
      expect(pv).toBeLessThanOrEqual(previous);
      previous = pv;
    }
  });

  it("builds a yearly series that ends at the full total", () => {
    const series = cumulativeSeries(10000, 3, 6);
    expect(series).toHaveLength(4);
    expect(series[0]).toEqual({ year: 0, nominal: 0, presentValue: 0 });
    expect(series[3].nominal).toBe(nominalTotal(10000, 3));
    expect(series[3].presentValue).toBe(presentValue(10000, 3, 6));
  });

  it("formats rupees in Indian grouping", () => {
    expect(formatInr(4500000)).toBe("₹45,00,000");
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(-0)).toBe("₹0");
    expect(formatInr(1234.5, true)).toBe("₹1,234.50");
    expect(formatInrCompact(950)).toBe("₹950");
    expect(formatInrCompact(12000)).toBe("₹12,000");
    expect(formatInrCompact(450000)).toBe("₹4.5 L");
    expect(formatInrCompact(12000000)).toBe("₹1.2 Cr");
    expect(formatInrCompact(-250000)).toBe("-₹2.5 L");
  });
});

describe("rule packs", () => {
  it("gives the hand-calculated amounts for the sample data", () => {
    const inputs = sampleInputs();
    const amount = (id: string) =>
      runRulePack(getPack(id)!, inputs, resolveParams(getPack(id)!)).monthly;
    // need gap 12000 + 5000 - 8000 = 9000; capacity 60000 - 20000 - 5000 = 35000
    expect(amount("needs-gap")).toBe(9000);
    // combined 68000, half is 34000, gap 26000, capacity 35000
    expect(amount("income-equalisation")).toBe(26000);
    // yours -9000, theirs 35000, pool 26000, target 13000, transfer 22000
    expect(amount("disposable-equalisation")).toBe(22000);
    expect(amount("manual")).toBe(0);
  });

  it("scales with the coverage setting and is capped by capacity", () => {
    const inputs = sampleInputs();
    const pack = getPack("needs-gap")!;
    expect(runRulePack(pack, inputs, { coveragePct: 75 }).monthly).toBe(6750);
    expect(runRulePack(pack, inputs, { coveragePct: 150 }).monthly).toBe(13500);
    const tight = { ...inputs, respondentIncome: 28000 };
    expect(runRulePack(pack, tight, { coveragePct: 100 }).monthly).toBe(3000);
  });

  it("explains each result in steps", () => {
    const inputs = sampleInputs();
    for (const pack of RULE_PACKS) {
      const outcome = runRulePack(pack, inputs, resolveParams(pack));
      expect(outcome.steps.length).toBeGreaterThan(0);
      const last = outcome.steps[outcome.steps.length - 1];
      expect(last.label).toBe("Monthly amount");
      expect(last.value).toBe(outcome.monthly);
    }
  });

  it("keeps parameters in range and prefers user edits over profile and default", () => {
    const pack = getPack("needs-gap")!;
    expect(resolveParams(pack, undefined, { coveragePct: 999 })).toEqual({
      coveragePct: 150,
    });
    expect(resolveParams(pack, undefined, { coveragePct: -5 })).toEqual({
      coveragePct: 0,
    });
    expect(resolveParams(pack, undefined, { coveragePct: Number.NaN })).toEqual(
      { coveragePct: 100 },
    );
    const profile = {
      ...getJurisdiction("custom")!,
      paramOverrides: { "needs-gap": { coveragePct: 60 } },
    };
    expect(resolveParams(pack, profile)).toEqual({ coveragePct: 60 });
    expect(resolveParams(pack, profile, { coveragePct: 80 })).toEqual({
      coveragePct: 80,
    });
  });

  it("never returns a negative or invalid amount, whatever the inputs", () => {
    const next = random(42);
    const money = () => Math.round(next() * 200000);
    for (let i = 0; i < 400; i++) {
      const inputs: SettlementInputs = {
        applicantIncome: money(),
        respondentIncome: money(),
        applicantExpenses: money(),
        respondentExpenses: money(),
        childCosts: money(),
        applicantDebtPayments: money(),
        respondentDebtPayments: money(),
        assets: [],
        debts: [],
      };
      for (const pack of RULE_PACKS) {
        const { monthly } = runRulePack(pack, inputs, resolveParams(pack));
        expect(Number.isFinite(monthly)).toBe(true);
        expect(monthly).toBeGreaterThanOrEqual(0);
        // the other party can never be asked for more than they have left
        const surplus = Math.max(
          0,
          inputs.respondentIncome -
            inputs.respondentExpenses -
            inputs.respondentDebtPayments,
        );
        expect(monthly).toBeLessThanOrEqual(surplus + 0.01);
      }
    }
  });

  it("warns when there is no income or no surplus", () => {
    const inputs = sampleInputs();
    const pack = getPack("needs-gap")!;
    const none = runRulePack(
      pack,
      { ...inputs, applicantIncome: 0, respondentIncome: 0 },
      {},
    );
    expect(none.monthly).toBe(0);
    expect(none.warnings.join(" ")).toMatch(/No income/);
    const noSurplus = runRulePack(
      pack,
      { ...inputs, respondentIncome: 20000, respondentExpenses: 20000 },
      {},
    );
    expect(noSurplus.monthly).toBe(0);
    expect(noSurplus.warnings.join(" ")).toMatch(/no surplus/);
  });

  it("is honest about what the packs are", () => {
    expect(new Set(RULE_PACKS.map((p) => p.id)).size).toBe(RULE_PACKS.length);
    for (const pack of RULE_PACKS) expect(pack.verified).toBe(false);
    for (const profile of JURISDICTIONS) {
      expect(profile.verified).toBe(false);
      for (const id of profile.packIds) expect(getPack(id)).toBeDefined();
    }
    expect(getJurisdiction("central")!.references.length).toBeGreaterThan(0);
  });
});

describe("settlement engine", () => {
  it("distributes joint items by the slider (hand-calculated)", () => {
    const inputs = sampleInputs();
    const even = distribute(inputs, {
      splitPctApplicant: 50,
      poolScope: "joint-only",
    });
    expect(even.applicant.netWorth).toBe(1_800_000);
    expect(even.respondent.netWorth).toBe(2_450_000);
    expect(even.combinedNetWorth).toBe(4_250_000);
    expect(even.shiftVsEqualJoint).toBe(0);

    const seventy = distribute(inputs, {
      splitPctApplicant: 70,
      poolScope: "joint-only",
    });
    expect(seventy.applicant.netWorth).toBe(2_460_000);
    expect(seventy.respondent.netWorth).toBe(1_790_000);
    expect(seventy.shiftVsEqualJoint).toBe(660_000);
  });

  it("can pool every asset and debt", () => {
    const inputs = sampleInputs();
    const half = distribute(inputs, {
      splitPctApplicant: 50,
      poolScope: "all-assets",
    });
    expect(half.applicant.netWorth).toBe(2_125_000);
    expect(half.respondent.netWorth).toBe(2_125_000);
    const all = distribute(inputs, {
      splitPctApplicant: 100,
      poolScope: "all-assets",
    });
    expect(all.respondent.netWorth).toBe(0);
    expect(all.applicantSharePct).toBe(100);
  });

  it("never creates or loses money, for any split and scope", () => {
    const inputs = sampleInputs();
    const expected = 5_600_000 - 1_350_000;
    for (const scope of ["joint-only", "all-assets"] as const)
      for (let pct = 0; pct <= 100; pct += 7) {
        const d = distribute(inputs, { splitPctApplicant: pct, poolScope: scope });
        expect(d.combinedNetWorth).toBeCloseTo(expected, 2);
        expect(d.applicant.netWorth + d.respondent.netWorth).toBeCloseTo(
          expected,
          2,
        );
      }
  });

  it("combines distribution and maintenance into one result", () => {
    const inputs = sampleInputs();
    const scenario = createScenario("s1", "Base", {
      monthlyAmount: 9000,
      years: 5,
      discountRatePct: 6,
    });
    const result = runScenario(inputs, scenario);
    expect(result.maintenance.suggestedMonthly).toBe(9000);
    expect(result.maintenance.nominalTotal).toBe(540000);
    expect(result.maintenance.presentValue).toBe(presentValue(9000, 5, 6));
    expect(result.maintenance.presentValue).toBe(467314.39);
    expect(result.maintenance.respondentSurplusBefore).toBe(35000);
    expect(result.maintenance.respondentSurplusAfter).toBe(26000);
    expect(result.maintenance.applicantNeeds).toBe(17000);
    expect(result.maintenance.applicantCoveragePct).toBeCloseTo(100, 6);
    expect(result.maintenance.series).toHaveLength(6);
    expect(result.applicantTotal).toBe(1_800_000 + 467_314.39);
    expect(
      result.applicantTotal + result.respondentTotal,
    ).toBeCloseTo(result.distribution.combinedNetWorth, 2);
  });

  it("raises clear warnings", () => {
    const inputs = sampleInputs();
    const base = createScenario("s1", "Base", { monthlyAmount: 9000 });
    expect(runScenario(inputs, base).warnings).toEqual([
      "Assumes the children live with you.",
    ]);

    const tooMuch = runScenario(inputs, { ...base, monthlyAmount: 50000 });
    expect(tooMuch.warnings.join(" ")).toMatch(/more than the other party/);

    const noYears = runScenario(inputs, { ...base, years: 0 });
    expect(noYears.warnings.join(" ")).toMatch(/Years is 0/);

    const noJoint = runScenario(
      {
        ...inputs,
        assets: inputs.assets.filter((r) => r.owner !== "joint"),
        debts: inputs.debts.filter((r) => r.owner !== "joint"),
      },
      base,
    );
    expect(noJoint.warnings.join(" ")).toMatch(/split slider has no effect/);

    const underwater = runScenario(
      {
        ...inputs,
        debts: [{ id: "d", label: "Loan", owner: "applicant", value: 9_000_000 }],
      },
      base,
    );
    expect(underwater.warnings.join(" ")).toMatch(/Your debts are higher/);
    expect(underwater.distribution.applicantSharePct).toBe(0);
  });

  it("falls back safely when saved ids are out of date", () => {
    const inputs = sampleInputs();
    const stale = runScenario(
      inputs,
      createScenario("s1", "Old", { packId: "gone" }),
      { jurisdictionId: "nope", paramOverrides: {} },
    );
    expect(stale.rule.packId).toBe("needs-gap");
    expect(stale.warnings.join(" ")).toMatch(/rule pack was not found/);
    expect(stale.warnings.join(" ")).toMatch(/jurisdiction profile was not found/);
  });

  it("uses parameter edits from the settings", () => {
    const inputs = sampleInputs();
    const settings: EngineSettings = {
      jurisdictionId: "custom",
      paramOverrides: { "needs-gap": { coveragePct: 50 } },
    };
    const result = runScenario(inputs, createScenario("s1", "A"), settings);
    expect(result.maintenance.suggestedMonthly).toBe(4500);
    expect(result.rule.params).toEqual({ coveragePct: 50 });
  });

  it("compares scenarios against the first", () => {
    const inputs = sampleInputs();
    const a = createScenario("a", "A", { monthlyAmount: 9000 });
    const b = createScenario("b", "B", {
      splitPctApplicant: 70,
      monthlyAmount: 5000,
    });
    const [first, second] = compareScenarios(inputs, [a, b]);
    expect(first.applicantTotalVsFirst).toBe(0);
    expect(second.applicantTotalVsFirst).toBeCloseTo(
      second.result.applicantTotal - first.result.applicantTotal,
      2,
    );
    expect(compareScenarios(inputs, [])).toEqual([]);
  });
});