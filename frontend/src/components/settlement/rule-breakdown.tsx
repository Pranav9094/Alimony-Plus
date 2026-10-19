"use client";

import { useState } from "react";

export interface RuleBreakdownStep {
  label: string;
  description: string;
  amount?: number;
}

export interface RuleBreakdownParty {
  label: string;
  grossAssets: number;
  allocatedDebts: number;
  netAssets: number;
}

export interface RuleBreakdownData {
  ruleName: string;
  ruleDescription: string;
  verified: boolean;
  jurisdictionName: string;
  statuteReferences: string[];
  assumptions: string[];
  steps: RuleBreakdownStep[];
  parties: RuleBreakdownParty[];
  monthlyMaintenance: number;
  totalMaintenance: number;
  presentValue: number;
  warnings: string[];
}

interface RuleBreakdownProps {
  data: RuleBreakdownData;
}

function formatINR(value: number): string {
  if (!Number.isFinite(value)) return "Unavailable";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function RuleBreakdown({ data }: RuleBreakdownProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-slate-900">
          Calculation breakdown
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Review the assumptions and calculation steps behind this settlement
          scenario.
        </p>
      </header>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-xl">
            ⚖️
          </span>

          <div>
            <h3 className="font-semibold text-amber-950">
              Illustrative planning calculation
            </h3>

            <p className="mt-1 text-sm leading-6 text-amber-900">
              This calculation is based on the selected assumptions. It does not
              establish legal entitlement or predict a court's decision.
            </p>
          </div>
        </div>
      </section>

      <Section title="Selected rule pack">
        <h4 className="font-semibold text-slate-900">{data.ruleName}</h4>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          {data.ruleDescription}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {data.jurisdictionName}
          </span>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              data.verified
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {data.verified
              ? "Verified configuration"
              : "Unverified — review required"}
          </span>
        </div>

        {data.statuteReferences.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-medium text-slate-700">
              Statutory references
            </h5>

            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
              {data.statuteReferences.map((reference, index) => (
                <li key={`${reference}-${index}`}>{reference}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Financial results">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Monthly maintenance</p>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {formatINR(data.monthlyMaintenance)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Scheduled total</p>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {formatINR(data.totalMaintenance)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Present value</p>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {formatINR(data.presentValue)}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Asset and debt distribution">
        {data.parties.length === 0 ? (
          <p className="text-sm text-slate-500">
            No party-level allocation details are available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 pr-4 font-medium">Party</th>
                  <th className="py-3 pr-4 font-medium">Assets</th>
                  <th className="py-3 pr-4 font-medium">Debts</th>
                  <th className="py-3 font-medium">Net assets</th>
                </tr>
              </thead>

              <tbody>
                {data.parties.map((party) => (
                  <tr
                    key={party.label}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <th className="py-3 pr-4 font-medium text-slate-800">
                      {party.label}
                    </th>

                    <td className="py-3 pr-4 text-slate-600">
                      {formatINR(party.grossAssets)}
                    </td>

                    <td className="py-3 pr-4 text-slate-600">
                      {formatINR(party.allocatedDebts)}
                    </td>

                    <td className="py-3 font-semibold text-slate-900">
                      {formatINR(party.netAssets)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Calculation steps">
        {data.steps.length === 0 ? (
          <p className="text-sm text-slate-500">
            Calculation steps are not available.
          </p>
        ) : (
          <ol className="space-y-4">
            {data.steps.map((step, index) => (
              <li key={`${step.label}-${index}`} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-slate-900">{step.label}</h4>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>

                  {step.amount !== undefined && (
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {formatINR(step.amount)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Assumptions and limitations">
        {data.assumptions.length === 0 ? (
          <p className="text-sm text-slate-500">
            No additional assumptions provided.
          </p>
        ) : (
          <ul className="list-inside list-disc space-y-2 text-sm leading-6 text-slate-600">
            {data.assumptions.map((assumption, index) => (
              <li key={`${assumption}-${index}`}>{assumption}</li>
            ))}
          </ul>
        )}
      </Section>

      {data.warnings.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Important warnings</h3>

          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-6 text-amber-900">
            {data.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          aria-expanded={showTechnicalDetails}
          onClick={() => setShowTechnicalDetails((previous) => !previous)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <span className="font-medium text-slate-800">Technical details</span>

          <span aria-hidden="true">{showTechnicalDetails ? "−" : "+"}</span>
        </button>

        {showTechnicalDetails && (
          <div className="border-t border-slate-200 p-4">
            <p className="text-sm leading-6 text-slate-600">
              The displayed results should be generated by the application's
              settlement engine. This component only presents the supplied
              results and does not independently calculate or verify legal
              obligations.
            </p>
          </div>
        )}
      </section>

      <p className="text-xs leading-5 text-slate-500">
        Illustrative planning only, not legal advice. Verify applicable law and
        all assumptions with a qualified legal professional.
      </p>
    </div>
  );
}
