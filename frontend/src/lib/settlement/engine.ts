import {
  cumulativeSeries,
  nominalTotal,
  percentOf,
  presentValue,
  roundMoney,
  splitTotal,
  sumMoney,
  type YearPoint,
} from "./finance";
import {
  DEFAULT_JURISDICTION_ID,
  DEFAULT_PACK_ID,
  getJurisdiction,
  getPack,
  resolveParams,
  runRulePack,
  type RuleStep,
} from "./rules";
import type { Owner, Row, Scenario, SettlementInputs } from "./schemas";

export type EngineSettings = {
  jurisdictionId: string;
  /** pack id -> param id -> value, set by the user */
  paramOverrides: Record<string, Record<string, number>>;
};

export const DEFAULT_SETTINGS: EngineSettings = {
  jurisdictionId: DEFAULT_JURISDICTION_ID,
  paramOverrides: {},
};

export type PartyHoldings = {
  assets: number;
  debts: number;
  netWorth: number;
};

export type DistributionResult = {
  applicant: PartyHoldings;
  respondent: PartyHoldings;
  combinedNetWorth: number;
  /** Your share of the combined net worth (0 when the combined net worth is not positive). */
  applicantSharePct: number;
  /** Change in your net worth compared with splitting joint items 50/50. */
  shiftVsEqualJoint: number;
};

export type MaintenanceResult = {
  suggestedMonthly: number;
  appliedMonthly: number;
  years: number;
  discountRatePct: number;
  nominalTotal: number;
  presentValue: number;
  series: YearPoint[];
  respondentSurplusBefore: number;
  respondentSurplusAfter: number;
  applicantNeeds: number;
  applicantCoveragePct: number;
};

export type ScenarioResult = {
  scenarioId: string;
  label: string;
  distribution: DistributionResult;
  maintenance: MaintenanceResult;
  rule: {
    packId: string;
    packName: string;
    params: Record<string, number>;
    steps: RuleStep[];
  };
  /** Net worth plus the present value of maintenance, in today's rupees. */
  applicantTotal: number;
  respondentTotal: number;
  warnings: string[];
};

export type ScenarioComparison = {
  result: ScenarioResult;
  /** Difference in your total compared with the first scenario. */
  applicantTotalVsFirst: number;
};

type Totals = Record<Owner, number>;

function totalsByOwner(rows: readonly Row[]): Totals {
  const totals: Totals = { applicant: 0, respondent: 0, joint: 0 };
  for (const row of rows)
    totals[row.owner] = roundMoney(totals[row.owner] + row.value);
  return totals;
}

function holdings(assets: number, debts: number): PartyHoldings {
  return {
    assets: roundMoney(assets),
    debts: roundMoney(debts),
    netWorth: roundMoney(assets - debts),
  };
}

function split(
  assets: Totals,
  debts: Totals,
  pctApplicant: number,
  scope: Scenario["poolScope"],
): { applicant: PartyHoldings; respondent: PartyHoldings } {
  if (scope === "all-assets") {
    const [aApplicant, aRespondent] = splitTotal(
      sumMoney([assets.applicant, assets.respondent, assets.joint]),
      pctApplicant,
    );
    const [dApplicant, dRespondent] = splitTotal(
      sumMoney([debts.applicant, debts.respondent, debts.joint]),
      pctApplicant,
    );
    return {
      applicant: holdings(aApplicant, dApplicant),
      respondent: holdings(aRespondent, dRespondent),
    };
  }
  const [jaApplicant, jaRespondent] = splitTotal(assets.joint, pctApplicant);
  const [jdApplicant, jdRespondent] = splitTotal(debts.joint, pctApplicant);
  return {
    applicant: holdings(
      assets.applicant + jaApplicant,
      debts.applicant + jdApplicant,
    ),
    respondent: holdings(
      assets.respondent + jaRespondent,
      debts.respondent + jdRespondent,
    ),
  };
}

export function distribute(
  inputs: SettlementInputs,
  scenario: Pick<Scenario, "splitPctApplicant" | "poolScope">,
): DistributionResult {
  const assets = totalsByOwner(inputs.assets);
  const debts = totalsByOwner(inputs.debts);
  const result = split(
    assets,
    debts,
    scenario.splitPctApplicant,
    scenario.poolScope,
  );
  const equalJoint = split(assets, debts, 50, "joint-only");
  const combined = roundMoney(
    result.applicant.netWorth + result.respondent.netWorth,
  );
  return {
    ...result,
    combinedNetWorth: combined,
    applicantSharePct:
      combined > 0 ? percentOf(result.applicant.netWorth, combined) : 0,
    shiftVsEqualJoint: roundMoney(
      result.applicant.netWorth - equalJoint.applicant.netWorth,
    ),
  };
}

export function runScenario(
  inputs: SettlementInputs,
  scenario: Scenario,
  settings: EngineSettings = DEFAULT_SETTINGS,
): ScenarioResult {
  const warnings: string[] = [];

  const profile = getJurisdiction(settings.jurisdictionId);
  if (!profile)
    warnings.push(
      "The chosen jurisdiction profile was not found. Using the central reference.",
    );
  const activeProfile = profile ?? getJurisdiction(DEFAULT_JURISDICTION_ID);

  let pack = getPack(scenario.packId);
  if (!pack) {
    warnings.push("The chosen rule pack was not found. Using the default pack.");
    pack = getPack(DEFAULT_PACK_ID);
  }
  if (!pack) throw new Error("No rule packs are registered.");

  const params = resolveParams(
    pack,
    activeProfile,
    settings.paramOverrides[pack.id] ?? {},
  );
  const outcome = runRulePack(pack, inputs, params);
  warnings.push(...outcome.warnings);

  const distribution = distribute(inputs, scenario);
  const applied = scenario.monthlyAmount;

  const surplusBefore = roundMoney(
    inputs.respondentIncome -
      inputs.respondentExpenses -
      inputs.respondentDebtPayments,
  );
  const surplusAfter = roundMoney(surplusBefore - applied);
  const needs = roundMoney(
    inputs.applicantExpenses +
      inputs.childCosts +
      inputs.applicantDebtPayments,
  );

  const pv = presentValue(applied, scenario.years, scenario.discountRatePct);
  const maintenance: MaintenanceResult = {
    suggestedMonthly: outcome.monthly,
    appliedMonthly: applied,
    years: scenario.years,
    discountRatePct: scenario.discountRatePct,
    nominalTotal: nominalTotal(applied, scenario.years),
    presentValue: pv,
    series: cumulativeSeries(applied, scenario.years, scenario.discountRatePct),
    respondentSurplusBefore: surplusBefore,
    respondentSurplusAfter: surplusAfter,
    applicantNeeds: needs,
    applicantCoveragePct: percentOf(inputs.applicantIncome + applied, needs),
  };

  if (applied > 0 && surplusAfter < 0)
    warnings.push(
      "The chosen monthly amount is more than the other party’s surplus after expenses and debt payments.",
    );
  if (applied > 0 && scenario.years === 0)
    warnings.push("Years is 0, so no maintenance is counted.");
  if (
    scenario.poolScope === "joint-only" &&
    inputs.assets.every((r) => r.owner !== "joint") &&
    inputs.debts.every((r) => r.owner !== "joint")
  )
    warnings.push(
      "No joint assets or debts are entered, so the split slider has no effect. Choose “All assets” to pool everything.",
    );
  if (distribution.applicant.netWorth < 0)
    warnings.push("Your debts are higher than your assets in this scenario.");
  if (distribution.respondent.netWorth < 0)
    warnings.push(
      "The other party’s debts are higher than their assets in this scenario.",
    );

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    distribution,
    maintenance,
    rule: { packId: pack.id, packName: pack.name, params, steps: outcome.steps },
    applicantTotal: roundMoney(distribution.applicant.netWorth + pv),
    respondentTotal: roundMoney(distribution.respondent.netWorth - pv),
    warnings: [...new Set(warnings)],
  };
}

export function compareScenarios(
  inputs: SettlementInputs,
  scenarios: readonly Scenario[],
  settings: EngineSettings = DEFAULT_SETTINGS,
): ScenarioComparison[] {
  const results = scenarios.map((s) => runScenario(inputs, s, settings));
  const first = results[0]?.applicantTotal ?? 0;
  return results.map((result) => ({
    result,
    applicantTotalVsFirst: roundMoney(result.applicantTotal - first),
  }));
}