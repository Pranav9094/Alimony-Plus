"use client";

import { useEffect, useMemo, useState } from "react";
import InputsForm from "./inputs-form";
import ScenarioPanel from "./scenario-panel";
import SettlementCharts from "./charts";
import RuleBreakdown from "./rule-breakdown";
import ReportTab from "./report-tab";

import { DEFAULT_SETTINGS, runScenario } from "@/lib/settlement/engine";
import { DEFAULT_PACK_ID, RULE_PACKS } from "@/lib/settlement/rules";
import {
  buildReport,
  type SettlementReport,
} from "@/lib/settlement/fingerprint";
import {
  defaultStudioState,
  loadStudioState,
  saveStudioState,
  updateScenario,
  removeScenario,
  addScenario,
} from "@/lib/settlement/scenarios-store";
import {
  parseSettlementForm,
  type SettlementFormValues,
} from "@/lib/settlement/schemas";

type Tab = "inputs" | "scenarios" | "results" | "report";

export default function SettlementStudio() {
  const [state, setState] = useState(defaultStudioState);
  const [activeTab, setActiveTab] = useState<Tab>("inputs");
  const [ready, setReady] = useState(false);
  const [validInputs, setValidInputs] = useState(false);
  const [report, setReport] = useState<SettlementReport | null>(null);

  useEffect(() => {
    try {
      const stored = loadStudioState();
      if (stored) setState(stored);
    } catch {
      // Keep the safe default state when local storage is unavailable.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    try {
      saveStudioState(state);
    } catch {
      // The studio remains usable if browser storage is unavailable.
    }
  }, [state, ready]);

  const parsed = useMemo(() => parseSettlementForm(state.form), [state.form]);

  const results = useMemo(() => {
    if (!parsed.ok) return [];

    return state.scenarios.map((scenario) =>
      runScenario(parsed.data, scenario, state.settings),
    );
  }, [parsed, state.scenarios, state.settings]);

  function updateForm(values: SettlementFormValues) {
    setState((current) => ({ ...current, form: values }));
    setReport(null);
  }

  async function generateReport() {
    if (!parsed.ok || state.scenarios.length === 0) {
      setActiveTab("inputs");
      return;
    }

    try {
      const nextReport = await buildReport({
        inputs: parsed.data,
        settings: state.settings,
        scenarios: state.scenarios,
      });

      setReport(nextReport);
      setActiveTab("report");
    } catch (error) {
      console.error("Could not generate settlement report:", error);
    }
  }

  const chartScenarios = results.map((result) => ({
    id: result.scenarioId,
    label: result.label,
    applicantAssets: result.distribution.applicant.assets,
    respondentAssets: result.distribution.respondent.assets,
    applicantDebt: result.distribution.applicant.debts,
    respondentDebt: result.distribution.respondent.debts,
    monthlyMaintenance: result.maintenance.appliedMonthly,
  }));

  const selectedResult = results[0];

  const breakdown = selectedResult
    ? {
        ruleName: selectedResult.rule.packName,
        ruleDescription:
          "Illustrative calculation using the selected rule pack and scenario assumptions.",
        verified: false,
        jurisdictionName: "Selected jurisdiction",
        statuteReferences: [] as string[],
        assumptions: [
          "Amounts are based on user-provided inputs.",
          "The calculation is illustrative and is not a legal determination.",
        ],
        steps: selectedResult.rule.steps.map((step) => ({
          label: step.label,
          description: step.note ?? step.kind,
          amount: step.kind === "money" ? step.value : undefined,
        })),
        parties: [
          {
            label: "Applicant",
            grossAssets: selectedResult.distribution.applicant.assets,
            allocatedDebts: selectedResult.distribution.applicant.debts,
            netAssets: selectedResult.distribution.applicant.netWorth,
          },
          {
            label: "Respondent",
            grossAssets: selectedResult.distribution.respondent.assets,
            allocatedDebts: selectedResult.distribution.respondent.debts,
            netAssets: selectedResult.distribution.respondent.netWorth,
          },
        ],
        monthlyMaintenance: selectedResult.maintenance.appliedMonthly,
        totalMaintenance: selectedResult.maintenance.nominalTotal,
        presentValue: selectedResult.maintenance.presentValue,
        warnings: selectedResult.warnings,
      }
    : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "inputs", label: "1. Financial inputs" },
    { id: "scenarios", label: "2. Scenarios" },
    { id: "results", label: "3. Analysis" },
    { id: "report", label: "4. Report & verification" },
  ];

  return (
    <main className="space-y-6">
      <header className="rounded-2xl bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
          Alimony+
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Settlement Studio
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Model financial scenarios, compare illustrative maintenance outcomes,
          inspect calculation assumptions, and generate a verifiable report.
        </p>
        <div className="mt-4 inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
          Illustrative planning only — not legal advice
        </div>
      </header>

      <nav
        aria-label="Settlement Studio sections"
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-teal-700 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {!ready ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading saved settlement workspace…
        </div>
      ) : (
        <>
          {activeTab === "inputs" && (
            <section className="space-y-4">
              <InputsForm
                initialValues={state.form}
                onChange={updateForm}
                onValidChange={(result) => setValidInputs(result.ok)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {parsed.ok
                    ? "Financial inputs are valid."
                    : "Review the form fields and correct validation errors."}
                </p>
                <button
                  type="button"
                  disabled={!parsed.ok}
                  onClick={() => setActiveTab("scenarios")}
                  className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue to scenarios →
                </button>
              </div>
            </section>
          )}

          {activeTab === "scenarios" && (
            <section className="space-y-4">
              <ScenarioPanel
                scenarios={state.scenarios}
                onChange={(scenarios) => {
                  setState((current) => ({ ...current, scenarios }));
                  setReport(null);
                }}
                rulePackOptions={RULE_PACKS.map((pack) => ({
                  id: pack.id,
                  name: pack.name,
                }))}
              />
              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("inputs")}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                >
                  ← Back to inputs
                </button>
                <button
                  type="button"
                  disabled={!parsed.ok || results.length === 0}
                  onClick={() => setActiveTab("results")}
                  className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Compare scenarios →
                </button>
              </div>
            </section>
          )}

          {activeTab === "results" && (
            <section className="space-y-5">
              {!parsed.ok && (
                <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  Correct the financial inputs before calculating.
                </p>
              )}

              {results.length > 0 && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {results.map((result) => (
                      <article
                        key={result.scenarioId}
                        className="rounded-xl border border-slate-200 bg-white p-5"
                      >
                        <h2 className="font-semibold text-slate-900">
                          {result.label}
                        </h2>
                        <p className="mt-4 text-sm text-slate-500">
                          Illustrative monthly maintenance
                        </p>
                        <p className="mt-1 text-2xl font-bold text-teal-800">
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          }).format(result.maintenance.appliedMonthly)}
                        </p>
                        <dl className="mt-4 space-y-2 text-sm">
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">
                              Applicant net worth
                            </dt>
                            <dd className="font-medium">
                              {Math.round(
                                result.distribution.applicant.netWorth,
                              ).toLocaleString("en-IN")}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">
                              Respondent net worth
                            </dt>
                            <dd className="font-medium">
                              {Math.round(
                                result.distribution.respondent.netWorth,
                              ).toLocaleString("en-IN")}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">Present value</dt>
                            <dd className="font-medium">
                              {Math.round(
                                result.maintenance.presentValue,
                              ).toLocaleString("en-IN")}
                            </dd>
                          </div>
                        </dl>
                        {result.warnings.length > 0 && (
                          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-amber-800">
                            {result.warnings.map((warning, index) => (
                              <li key={`${result.scenarioId}-warning-${index}`}>
                                {warning}
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>

                  <SettlementCharts scenarios={chartScenarios} />

                  {breakdown && <RuleBreakdown data={breakdown} />}
                </>
              )}

              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("scenarios")}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                >
                  ← Scenarios
                </button>
                <button
                  type="button"
                  disabled={!parsed.ok || results.length === 0}
                  onClick={generateReport}
                  className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Generate report →
                </button>
              </div>
            </section>
          )}

          {activeTab === "report" && (
            <section className="space-y-4">
              <ReportTab report={report} />
              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("results")}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                >
                  ← Back to analysis
                </button>
                <button
                  type="button"
                  disabled={!parsed.ok || results.length === 0}
                  onClick={generateReport}
                  className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 disabled:opacity-40"
                >
                  Refresh report
                </button>
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Settlement estimates are heuristic and depend on the supplied
        assumptions. They do not establish legal entitlement or predict a court
        decision. Report fingerprints detect changes to the report payload; they
        are not digital signatures.
      </p>
    </main>
  );
}
