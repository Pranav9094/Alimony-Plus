"use client";

import { useMemo } from "react";
import {
  createScenario,
  LIMITS,
  scenarioSchema,
  type Scenario,
} from "@/lib/settlement/schemas";
import { formatINR } from "./chart-scale";

interface ScenarioPanelProps {
  scenarios: Scenario[];
  onChange: (scenarios: Scenario[]) => void;
  rulePackOptions?: {
    id: string;
    name: string;
  }[];
}

const DEFAULT_PACKS = [
  { id: "needs-gap", name: "Needs gap (illustrative)" },
  { id: "income-equalisation", name: "Income equalisation (illustrative)" },
];

function ScenarioPanel({
  scenarios,
  onChange,
  rulePackOptions = DEFAULT_PACKS,
}: ScenarioPanelProps) {
  const packs = useMemo(
    () => (rulePackOptions.length > 0 ? rulePackOptions : DEFAULT_PACKS),
    [rulePackOptions],
  );

  function updateScenario(id: string, patch: Partial<Scenario>) {
    onChange(
      scenarios.map((scenario) => {
        if (scenario.id !== id) return scenario;

        return { ...scenario, ...patch };
      }),
    );
  }

  function addScenario() {
    if (scenarios.length >= 3) return;

    const index = scenarios.length;

    const scenario = createScenario(
      `scenario-${Date.now()}`,
      ["Scenario A", "Scenario B", "Scenario C"][index],
      {
        packId: packs[0].id,
      },
    );

    onChange([...scenarios, scenario]);
  }

  function removeScenario(id: string) {
    if (scenarios.length <= 1) return;

    onChange(scenarios.filter((scenario) => scenario.id !== id));
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Settlement scenarios
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Adjust settlement assumptions and compare possible outcomes.
          </p>
        </div>

        <button
          type="button"
          onClick={addScenario}
          disabled={scenarios.length >= 3}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add scenario
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {scenarios.map((scenario, index) => {
          const parsed = scenarioSchema.safeParse(scenario);

          const monthlyTotal = scenario.monthlyAmount * 12 * scenario.years;

          return (
            <article
              key={scenario.id}
              className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                    Scenario {String.fromCharCode(65 + index)}
                  </p>

                  <label
                    htmlFor={`${scenario.id}-label`}
                    className="mt-2 block text-sm font-medium text-slate-700"
                  >
                    Scenario name
                  </label>

                  <input
                    id={`${scenario.id}-label`}
                    value={scenario.label}
                    maxLength={LIMITS.scenarioLabelMax}
                    onChange={(event) =>
                      updateScenario(scenario.id, {
                        label: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />

                  {!parsed.success &&
                    parsed.error.issues.some((issue) =>
                      issue.path.includes("label"),
                    ) && (
                      <p className="mt-1 text-xs text-red-600" role="alert">
                        Enter a valid scenario name.
                      </p>
                    )}
                </div>

                {scenarios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeScenario(scenario.id)}
                    aria-label={`Remove ${scenario.label}`}
                    className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor={`${scenario.id}-pack`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Illustrative rule pack
                </label>

                <select
                  id={`${scenario.id}-pack`}
                  value={scenario.packId}
                  onChange={(event) =>
                    updateScenario(scenario.id, {
                      packId: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  {packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={`${scenario.id}-pool`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Asset pool
                </label>

                <select
                  id={`${scenario.id}-pool`}
                  value={scenario.poolScope}
                  onChange={(event) =>
                    updateScenario(scenario.id, {
                      poolScope: event.target.value as Scenario["poolScope"],
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <option value="joint-only">Joint assets only</option>
                  <option value="all-assets">All assets</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={`${scenario.id}-split`}
                    className="text-sm font-medium text-slate-700"
                  >
                    Applicant asset share
                  </label>

                  <output
                    htmlFor={`${scenario.id}-split`}
                    className="text-sm font-bold text-teal-800"
                  >
                    {scenario.splitPctApplicant}%
                  </output>
                </div>

                <input
                  id={`${scenario.id}-split`}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={scenario.splitPctApplicant}
                  onChange={(event) =>
                    updateScenario(scenario.id, {
                      splitPctApplicant: Number(event.target.value),
                    })
                  }
                  className="w-full accent-teal-700"
                />

                <div className="flex justify-between text-xs text-slate-500">
                  <span>0% applicant</span>
                  <span>100% applicant</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={`${scenario.id}-monthly`}
                    className="text-sm font-medium text-slate-700"
                  >
                    Monthly maintenance
                  </label>

                  <output
                    htmlFor={`${scenario.id}-monthly`}
                    className="text-sm font-bold text-slate-900"
                  >
                    {formatINR(scenario.monthlyAmount)}
                  </output>
                </div>

                <input
                  id={`${scenario.id}-monthly`}
                  type="range"
                  min="0"
                  max="200000"
                  step="1000"
                  value={Math.min(scenario.monthlyAmount, 200000)}
                  onChange={(event) =>
                    updateScenario(scenario.id, {
                      monthlyAmount: Number(event.target.value),
                    })
                  }
                  className="w-full accent-teal-700"
                />

                <label
                  htmlFor={`${scenario.id}-monthly-number`}
                  className="block text-xs text-slate-500"
                >
                  Exact monthly amount (₹)
                </label>

                <input
                  id={`${scenario.id}-monthly-number`}
                  type="number"
                  min="0"
                  max={LIMITS.maxAmount}
                  value={scenario.monthlyAmount}
                  onChange={(event) =>
                    updateScenario(scenario.id, {
                      monthlyAmount:
                        event.target.value === ""
                          ? 0
                          : Number(event.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={`${scenario.id}-years`}
                    className="text-sm font-medium text-slate-700"
                  >
                    Duration
                  </label>

                  <output
                    htmlFor={`${scenario.id}-years`}
                    className="text-sm font-bold text-slate-900"
                  >
                    {scenario.years} years
                  </output>
                </div>

                <input
                  id={`${scenario.id}-years`}
                  type="range"
                  min="0"
                  max={LIMITS.maxYears}
                  step="1"
                  value={scenario.years}
                  onChange={(event) =>
                    updateScenario(scenario.id, {
                      years: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full accent-teal-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={`${scenario.id}-discount`}
                    className="text-sm font-medium text-slate-700"
                  >
                    Annual discount rate
                  </label>

                  <output
                    htmlFor={`${scenario.id}-discount`}
                    className="text-sm font-bold text-slate-900"
                  >
                    {scenario.discountRatePct}%
                  </output>
                </div>

                <input
                  id={`${scenario.id}-discount`}
                  type="range"
                  min="0"
                  max={LIMITS.maxDiscountPct}
                  step="0.5"
                  value={scenario.discountRatePct}
                  onChange={(event) =>
                    updateScenario(scenario.id, {
                      discountRatePct: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full accent-teal-700"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">
                  Undiscounted scheduled maintenance
                </p>

                <p className="mt-1 text-xl font-bold text-slate-900">
                  {formatINR(monthlyTotal)}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Monthly amount × 12 × duration. This is a projection, not a
                  prediction of legal entitlement.
                </p>
              </div>

              {!parsed.success && (
                <p className="text-xs text-amber-700">
                  Some scenario values need correction before calculation.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Illustrative planning only, not legal advice. The selected assumptions
        do not establish a legally payable amount.
      </p>
    </section>
  );
}

export default ScenarioPanel;
