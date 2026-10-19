import { describe, expect, it } from "vitest";
import {
  LIMITS,
  createScenario,
  emptyForm,
  parseScenario,
  parseSettlementForm,
  sampleForm,
  type SettlementFormValues,
} from "../src/lib/settlement/schemas";
import {
  MAX_SCENARIOS,
  addScenario,
  defaultStudioState,
  nextScenarioId,
  parseStudioState,
  removeScenario,
  updateScenario,
} from "../src/lib/settlement/scenarios-store";

function form(change: Partial<SettlementFormValues> = {}): SettlementFormValues {
  return { ...sampleForm(), ...change };
}

describe("financial input validation", () => {
  it("accepts the sample form and returns numbers", () => {
    const result = parseSettlementForm(sampleForm());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.applicantIncome).toBe(8000);
    expect(result.data.assets).toHaveLength(4);
    expect(result.data.assets[0].value).toBe(4_500_000);
    expect(typeof result.data.debts[1].value).toBe("number");
  });

  it("reads rupee signs, commas, spaces and decimals", () => {
    const result = parseSettlementForm(
      form({
        applicantIncome: "1,20,000",
        respondentIncome: "₹ 5,000",
        applicantExpenses: " 250 ",
        childCosts: "12.50",
        applicantDebtPayments: "0",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.applicantIncome).toBe(120000);
    expect(result.data.respondentIncome).toBe(5000);
    expect(result.data.applicantExpenses).toBe(250);
    expect(result.data.childCosts).toBe(12.5);
    expect(result.data.applicantDebtPayments).toBe(0);
  });

  it("gives one clear message per field", () => {
    const result = parseSettlementForm(
      form({
        applicantIncome: "",
        respondentIncome: "abc",
        applicantExpenses: "-5",
        respondentExpenses: "99999999999999",
        childCosts: "12abc",
        applicantDebtPayments: "Infinity",
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.applicantIncome).toBe(
      "Enter an amount. Use 0 only if it is really zero.",
    );
    expect(result.errors.respondentIncome).toBe("Enter a valid number.");
    expect(result.errors.applicantExpenses).toBe("The amount cannot be negative.");
    expect(result.errors.respondentExpenses).toBe(
      "This amount is too large to model.",
    );
    expect(result.errors.childCosts).toBe("Enter a valid number.");
    expect(result.errors.applicantDebtPayments).toBe("Enter a valid number.");
    expect(result.errors).not.toHaveProperty("respondentDebtPayments");
  });

  it("does not treat an empty box as zero", () => {
    const result = parseSettlementForm(emptyForm());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toHaveLength(7);
  });

  it("points at the exact asset or debt row that is wrong", () => {
    const base = sampleForm();
    const result = parseSettlementForm({
      ...base,
      assets: [
        { ...base.assets[0], label: "   " },
        { ...base.assets[1], value: "-1" },
        { ...base.assets[2], owner: "stranger" as never },
      ],
      debts: [{ ...base.debts[0], value: "" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors["assets.0.label"]).toBe("Name this asset.");
    expect(result.errors["assets.1.value"]).toBe("The amount cannot be negative.");
    expect(result.errors).toHaveProperty("assets.2.owner");
    expect(result.errors["debts.0.value"]).toBe(
      "Enter an amount. Use 0 only if it is really zero.",
    );
  });

  it("trims names and limits how many rows and how long a name", () => {
    const base = sampleForm();
    const trimmed = parseSettlementForm({
      ...base,
      assets: [{ ...base.assets[0], label: "  Home  " }],
    });
    expect(trimmed.ok && trimmed.data.assets[0].label).toBe("Home");

    const long = parseSettlementForm({
      ...base,
      assets: [{ ...base.assets[0], label: "x".repeat(LIMITS.labelMax + 1) }],
    });
    expect(long.ok).toBe(false);

    const many = parseSettlementForm({
      ...base,
      assets: Array.from({ length: LIMITS.maxRows + 1 }, (_, i) => ({
        ...base.assets[0],
        id: `a${i}`,
      })),
    });
    expect(many.ok).toBe(false);
    if (!many.ok)
      expect(many.errors.assets).toBe(`Add at most ${LIMITS.maxRows} assets.`);
  });
});

describe("scenario validation", () => {
  it("accepts a default scenario", () => {
    expect(parseScenario(createScenario("a", "A")).ok).toBe(true);
  });

  it("rejects values outside the slider ranges with plain messages", () => {
    const result = parseScenario({
      ...createScenario("a", "  "),
      splitPctApplicant: 120,
      monthlyAmount: -1,
      years: 2.5,
      discountRatePct: 31,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.label).toBe("Give the scenario a name.");
    expect(result.errors.splitPctApplicant).toBe("Share cannot be above 100%.");
    expect(result.errors.monthlyAmount).toBe("Monthly amount cannot be negative.");
    expect(result.errors.years).toBe("Use whole years.");
    expect(result.errors.discountRatePct).toBe("Use 30% or less.");
  });

  it("accepts the edges of every range", () => {
    for (const patch of [
      { splitPctApplicant: 0, years: 0, discountRatePct: 0, monthlyAmount: 0 },
      {
        splitPctApplicant: 100,
        years: LIMITS.maxYears,
        discountRatePct: LIMITS.maxDiscountPct,
        monthlyAmount: LIMITS.maxAmount,
      },
    ])
      expect(parseScenario(createScenario("a", "A", patch)).ok).toBe(true);
    expect(
      parseScenario(createScenario("a", "A", { years: LIMITS.maxYears + 1 })).ok,
    ).toBe(false);
  });

  it("rejects numbers that are not numbers", () => {
    for (const monthlyAmount of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = parseScenario({
        ...createScenario("a", "A"),
        monthlyAmount,
      });
      expect(result.ok).toBe(false);
    }
    expect(parseScenario(null).ok).toBe(false);
    expect(parseScenario("text").ok).toBe(false);
  });

  it("rejects an unknown pool scope", () => {
    expect(
      parseScenario({ ...createScenario("a", "A"), poolScope: "everything" }).ok,
    ).toBe(false);
  });
});

describe("saved studio state", () => {
  it("starts with valid sample data and three different scenarios", () => {
    const state = defaultStudioState();
    expect(parseSettlementForm(state.form).ok).toBe(true);
    expect(state.scenarios).toHaveLength(3);
    expect(new Set(state.scenarios.map((s) => s.id)).size).toBe(3);
    for (const s of state.scenarios) expect(parseScenario(s).ok).toBe(true);
    expect(defaultStudioState().scenarios[0]).not.toBe(state.scenarios[0]);
  });

  it("restores exactly what was saved", () => {
    const state = defaultStudioState();
    state.settings.paramOverrides = { "needs-gap": { coveragePct: 80 } };
    state.settings.jurisdictionId = "custom";
    expect(parseStudioState(JSON.stringify(state))).toEqual(state);
  });

  it("falls back to the defaults for missing or broken data", () => {
    const fresh = defaultStudioState();
    for (const raw of [null, "", "{not json", "42", "[]", "null", '"text"'])
      expect(parseStudioState(raw)).toEqual(fresh);
  });

  it("repairs messy data instead of failing", () => {
    const state = parseStudioState(
      JSON.stringify({
        form: {
          applicantIncome: 5000,
          respondentIncome: "40,000",
          childCosts: null,
          assets: [
            { id: "a", label: "Flat", owner: "weird", value: 100 },
            { id: "a", label: "Same id", owner: "joint", value: "5" },
            7,
            null,
          ],
          debts: "nope",
        },
        scenarios: [
          { ...createScenario("x", "Valid") },
          { id: "bad", label: "", splitPctApplicant: 900 },
          { ...createScenario("x", "Repeated id") },
        ],
        settings: {
          jurisdictionId: 7,
          paramOverrides: {
            "needs-gap": { coveragePct: 80, bad: "x" },
            junk: 5,
            empty: { a: "q" },
          },
        },
      }),
    );
    expect(state.form.applicantIncome).toBe("5000");
    expect(state.form.respondentIncome).toBe("40,000");
    expect(state.form.childCosts).toBe("");
    expect(state.form.assets).toHaveLength(2);
    expect(state.form.assets[0].owner).toBe("joint");
    expect(state.form.assets[0].id).not.toBe(state.form.assets[1].id);
    expect(state.form.debts).toEqual([]);
    expect(state.scenarios.map((s) => s.id)).toEqual(["x"]);
    expect(state.settings.jurisdictionId).toBe("central");
    expect(state.settings.paramOverrides).toEqual({
      "needs-gap": { coveragePct: 80 },
    });
  });

  it("brings back the defaults when no saved scenario is usable", () => {
    const state = parseStudioState(
      JSON.stringify({ form: {}, scenarios: [{ junk: 1 }] }),
    );
    expect(state.scenarios).toHaveLength(3);
    expect(parseStudioState(JSON.stringify({ scenarios: [] })).form).toEqual(
      sampleForm(),
    );
  });

  it("limits scenarios and rows", () => {
    const base = defaultStudioState().scenarios[0];
    const state = parseStudioState(
      JSON.stringify({
        scenarios: Array.from({ length: 6 }, (_, i) => ({ ...base, id: `q${i}` })),
        form: {
          assets: Array.from({ length: 40 }, (_, i) => ({
            id: `r${i}`,
            label: "L",
            owner: "joint",
            value: "1",
          })),
        },
      }),
    );
    expect(state.scenarios).toHaveLength(MAX_SCENARIOS);
    expect(state.form.assets).toHaveLength(LIMITS.maxRows);
  });
});

describe("scenario helpers", () => {
  const start = defaultStudioState().scenarios;

  it("adds a copy of the last scenario with a fresh id and name", () => {
    const added = addScenario([start[0]]);
    expect(added).toHaveLength(2);
    expect(added[1].id).toBe("scenario-2");
    expect(added[1].label).toBe("Scenario B");
    expect(added[1].monthlyAmount).toBe(start[0].monthlyAmount);
    expect(addScenario([])).toHaveLength(1);
  });

  it("stops at the limit", () => {
    expect(addScenario(start)).toHaveLength(MAX_SCENARIOS);
  });

  it("reuses a free id and name after a removal", () => {
    const fewer = removeScenario(start, "scenario-2");
    expect(fewer.map((s) => s.id)).toEqual(["scenario-1", "scenario-3"]);
    const again = addScenario(fewer);
    expect(again[2].id).toBe("scenario-2");
    expect(again[2].label).toBe("Scenario B");
    expect(nextScenarioId(start)).toBe("scenario-4");
  });

  it("always keeps one scenario", () => {
    expect(removeScenario([start[0]], "scenario-1")).toHaveLength(1);
    expect(removeScenario(start, "missing")).toHaveLength(3);
  });

  it("updates only the chosen scenario and leaves the original alone", () => {
    const updated = updateScenario(start, "scenario-2", {
      splitPctApplicant: 75,
    });
    expect(updated[1].splitPctApplicant).toBe(75);
    expect(updated[0].splitPctApplicant).toBe(start[0].splitPctApplicant);
    expect(start[1].splitPctApplicant).toBe(60);
  });
});