"use client";

import {
  createBarGeometry,
  formatINR,
  getChartDomain,
  getChartTicks,
  valueToY,
} from "./chart-scale";

export interface SettlementChartScenario {
  id: string;
  label: string;
  applicantAssets: number;
  respondentAssets: number;
  applicantDebt: number;
  respondentDebt: number;
  monthlyMaintenance: number;
}

interface SettlementChartsProps {
  scenarios: SettlementChartScenario[];
}

const WIDTH = 640;
const HEIGHT = 280;

const MARGIN = {
  top: 24,
  right: 24,
  bottom: 48,
  left: 84,
};

const COLORS = {
  applicant: "#0D9488",
  respondent: "#6366F1",
  maintenance: "#D97706",
  grid: "#E5E7EB",
  text: "#475569",
};

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>

      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 text-xs text-slate-600"
        >
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">
      Create a settlement scenario to display the chart.
    </div>
  );
}

function GroupedBarChart({
  scenarios,
  title,
  description,
  applicantValue,
  respondentValue,
}: {
  scenarios: SettlementChartScenario[];
  title: string;
  description: string;
  applicantValue: (scenario: SettlementChartScenario) => number;
  respondentValue: (scenario: SettlementChartScenario) => number;
}) {
  if (scenarios.length === 0) {
    return (
      <ChartCard title={title} description={description}>
        <EmptyChart />
      </ChartCard>
    );
  }

  const values = scenarios.flatMap((scenario) => [
    applicantValue(scenario),
    respondentValue(scenario),
  ]);

  const domain = getChartDomain(values, { min: 0 });
  const ticks = getChartTicks(domain);

  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const groupWidth = plotWidth / scenarios.length;
  const barWidth = Math.min(34, groupWidth * 0.28);

  return (
    <ChartCard title={title} description={description}>
      <div className="w-full overflow-x-auto">
        <svg
          role="img"
          aria-label={`${title}. ${scenarios
            .map(
              (scenario) =>
                `${scenario.label}: applicant ${formatINR(
                  applicantValue(scenario),
                )}, respondent ${formatINR(respondentValue(scenario))}`,
            )
            .join(". ")}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[340px]"
        >
          {ticks.map((tick) => {
            const y = valueToY(tick.value, domain, MARGIN.top, plotHeight);

            return (
              <g key={tick.value}>
                <line
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={y}
                  y2={y}
                  stroke={COLORS.grid}
                  strokeDasharray="4 4"
                />

                <text
                  x={MARGIN.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill={COLORS.text}
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {scenarios.map((scenario, index) => {
            const center = MARGIN.left + groupWidth * (index + 0.5);

            const applicant = createBarGeometry(
              applicantValue(scenario),
              domain,
              center - barWidth - 2,
              barWidth,
              MARGIN.top,
              plotHeight,
            );

            const respondent = createBarGeometry(
              respondentValue(scenario),
              domain,
              center + 2,
              barWidth,
              MARGIN.top,
              plotHeight,
            );

            return (
              <g key={scenario.id}>
                <rect {...applicant} rx="3" fill={COLORS.applicant}>
                  <title>
                    {scenario.label} applicant:{" "}
                    {formatINR(applicantValue(scenario))}
                  </title>
                </rect>

                <rect {...respondent} rx="3" fill={COLORS.respondent}>
                  <title>
                    {scenario.label} respondent:{" "}
                    {formatINR(respondentValue(scenario))}
                  </title>
                </rect>

                <text
                  x={center}
                  y={HEIGHT - 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill={COLORS.text}
                >
                  {scenario.label.length > 12
                    ? `${scenario.label.slice(0, 11)}…`
                    : scenario.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <Legend
        items={[
          { label: "Applicant", color: COLORS.applicant },
          { label: "Respondent", color: COLORS.respondent },
        ]}
      />
    </ChartCard>
  );
}

function MaintenanceChart({
  scenarios,
}: {
  scenarios: SettlementChartScenario[];
}) {
  if (scenarios.length === 0) {
    return (
      <ChartCard
        title="Monthly maintenance"
        description="Compare the proposed monthly maintenance across scenarios."
      >
        <EmptyChart />
      </ChartCard>
    );
  }

  const values = scenarios.map((scenario) => scenario.monthlyMaintenance);

  const domain = getChartDomain(values, { min: 0 });
  const ticks = getChartTicks(domain);

  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const groupWidth = plotWidth / scenarios.length;
  const barWidth = Math.min(52, groupWidth * 0.55);

  return (
    <ChartCard
      title="Monthly maintenance"
      description="Compare the proposed monthly maintenance across scenarios."
    >
      <div className="w-full overflow-x-auto">
        <svg
          role="img"
          aria-label={`Monthly maintenance comparison: ${scenarios
            .map(
              (scenario) =>
                `${scenario.label}: ${formatINR(
                  scenario.monthlyMaintenance,
                )} per month`,
            )
            .join(". ")}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[340px]"
        >
          {ticks.map((tick) => {
            const y = valueToY(tick.value, domain, MARGIN.top, plotHeight);

            return (
              <g key={tick.value}>
                <line
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={y}
                  y2={y}
                  stroke={COLORS.grid}
                  strokeDasharray="4 4"
                />

                <text
                  x={MARGIN.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill={COLORS.text}
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {scenarios.map((scenario, index) => {
            const x = MARGIN.left + groupWidth * (index + 0.5) - barWidth / 2;

            const bar = createBarGeometry(
              scenario.monthlyMaintenance,
              domain,
              x,
              barWidth,
              MARGIN.top,
              plotHeight,
            );

            return (
              <g key={scenario.id}>
                <rect {...bar} rx="4" fill={COLORS.maintenance}>
                  <title>
                    {scenario.label}: {formatINR(scenario.monthlyMaintenance)}{" "}
                    per month
                  </title>
                </rect>

                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill={COLORS.text}
                >
                  {scenario.label.length > 12
                    ? `${scenario.label.slice(0, 11)}…`
                    : scenario.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <Legend
        items={[{ label: "Monthly maintenance", color: COLORS.maintenance }]}
      />
    </ChartCard>
  );
}

export default function SettlementCharts({ scenarios }: SettlementChartsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Settlement analytics
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Compare asset allocation, debt distribution and proposed monthly
          maintenance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <GroupedBarChart
          scenarios={scenarios}
          title="Asset distribution"
          description="Compare the asset values allocated to each party."
          applicantValue={(scenario) => scenario.applicantAssets}
          respondentValue={(scenario) => scenario.respondentAssets}
        />

        <GroupedBarChart
          scenarios={scenarios}
          title="Debt distribution"
          description="Compare the debt allocated to each party."
          applicantValue={(scenario) => scenario.applicantDebt}
          respondentValue={(scenario) => scenario.respondentDebt}
        />

        <div className="xl:col-span-2">
          <MaintenanceChart scenarios={scenarios} />
        </div>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Illustrative financial planning only. These charts do not determine
        legal entitlement or predict a court outcome.
      </p>
    </div>
  );
}
