import { runScenario, type EngineSettings, type ScenarioResult } from "./engine";
import {
  AMOUNT_FIELDS,
  emptyForm,
  parseScenario,
  parseSettlementForm,
  type Owner,
  type Scenario,
  type SettlementFormValues,
  type SettlementInputs,
} from "./schemas";

export const REPORT_SCHEMA = "alimony-plus.settlement-report.v1";

/** Everything the fingerprint covers. */
export type ReportPayload = {
  schema: typeof REPORT_SCHEMA;
  createdAt: string;
  inputs: SettlementInputs;
  settings: EngineSettings;
  scenarios: Scenario[];
  results: ScenarioResult[];
};

export type SettlementReport = ReportPayload & {
  reportId: string;
  sha256: string;
};

export type VerifyResult = {
  ok: boolean;
  /** The stored fingerprint matches the report contents. */
  hashMatches: boolean;
  /** Running the calculation again gives the stored results. */
  calculationMatches: boolean;
  reason?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Cannot fingerprint a number that is not finite.");
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort())
      if (source[key] !== undefined) out[key] = sortValue(source[key]);
    return out;
  }
  throw new Error(`Cannot fingerprint a value of type ${typeof value}.`);
}

/** JSON with sorted keys, so the same content always gives the same text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle)
    throw new Error(
      "This browser cannot compute SHA-256 here. Open the page over HTTPS or on localhost.",
    );
  const bytes = new Uint8Array(
    await subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** STU-1A2B-3C4D-5E6F, taken from the start of the fingerprint. */
export function formatReportId(sha256: string): string {
  const s = sha256.slice(0, 12).toUpperCase();
  return `STU-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** Splits a hash into readable groups, e.g. for printing on two lines. */
export function groupHash(sha256: string, size = 8): string[] {
  const groups: string[] = [];
  for (let i = 0; i < sha256.length; i += size)
    groups.push(sha256.slice(i, i + size));
  return groups;
}

async function fingerprint(payload: ReportPayload) {
  const sha256 = await sha256Hex(canonicalJson(payload));
  return { sha256, reportId: formatReportId(sha256) };
}

export async function buildReport(args: {
  inputs: SettlementInputs;
  settings: EngineSettings;
  scenarios: Scenario[];
  now?: Date;
}): Promise<SettlementReport> {
  const payload: ReportPayload = {
    schema: REPORT_SCHEMA,
    createdAt: (args.now ?? new Date()).toISOString(),
    inputs: args.inputs,
    settings: args.settings,
    scenarios: args.scenarios,
    results: args.scenarios.map((s) =>
      runScenario(args.inputs, s, args.settings),
    ),
  };
  return { ...payload, ...(await fingerprint(payload)) };
}

const numberText = (value: unknown) =>
  typeof value === "number" ? String(value) : "";

function rowsToForm(value: unknown): SettlementFormValues["assets"] | null {
  if (!Array.isArray(value)) return null;
  const rows: SettlementFormValues["assets"] = [];
  for (const row of value) {
    if (!isRecord(row)) return null;
    rows.push({
      id: typeof row.id === "string" ? row.id : "",
      label: typeof row.label === "string" ? row.label : "",
      owner: String(row.owner) as Owner,
      value: numberText(row.value),
    });
  }
  return rows;
}

/** Re-checks stored inputs with the same rules the form uses. */
function validInputs(value: unknown): SettlementInputs | null {
  if (!isRecord(value)) return null;
  const form = emptyForm();
  for (const [key] of AMOUNT_FIELDS) form[key] = numberText(value[key]);
  const assets = rowsToForm(value.assets);
  const debts = rowsToForm(value.debts);
  if (!assets || !debts) return null;
  form.assets = assets;
  form.debts = debts;
  const parsed = parseSettlementForm(form);
  return parsed.ok ? parsed.data : null;
}

function validSettings(value: unknown): EngineSettings | null {
  if (
    !isRecord(value) ||
    typeof value.jurisdictionId !== "string" ||
    !isRecord(value.paramOverrides)
  )
    return null;
  const overrides: EngineSettings["paramOverrides"] = {};
  for (const [packId, params] of Object.entries(value.paramOverrides)) {
    if (!isRecord(params)) return null;
    const inner: Record<string, number> = {};
    for (const [key, n] of Object.entries(params)) {
      if (typeof n !== "number" || !Number.isFinite(n)) return null;
      inner[key] = n;
    }
    overrides[packId] = inner;
  }
  return { jurisdictionId: value.jurisdictionId, paramOverrides: overrides };
}

function validScenarios(value: unknown): Scenario[] | null {
  if (!Array.isArray(value)) return null;
  const out: Scenario[] = [];
  for (const item of value) {
    const parsed = parseScenario(item);
    if (!parsed.ok) return null;
    out.push(parsed.data);
  }
  return out;
}

/**
 * Checks a report (for example one pasted from a saved file).
 * 1. The fingerprint matches the contents.
 * 2. The stored results are what the calculation gives for the stored inputs.
 * A fingerprint shows the file changed after it was made. It is not a digital
 * signature, so keep the report ID somewhere separate if it matters.
 */
export async function verifyReport(report: unknown): Promise<VerifyResult> {
  const fail = (reason: string): VerifyResult => ({
    ok: false,
    hashMatches: false,
    calculationMatches: false,
    reason,
  });
  if (
    !isRecord(report) ||
    report.schema !== REPORT_SCHEMA ||
    typeof report.createdAt !== "string" ||
    typeof report.sha256 !== "string" ||
    typeof report.reportId !== "string" ||
    !Array.isArray(report.results)
  )
    return fail("This does not look like a Settlement Studio report.");

  const payload = {
    schema: report.schema,
    createdAt: report.createdAt,
    inputs: report.inputs,
    settings: report.settings,
    scenarios: report.scenarios,
    results: report.results,
  };

  let actual: string;
  try {
    actual = await sha256Hex(canonicalJson(payload));
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "The report could not be read.",
    );
  }
  const hashMatches =
    actual === report.sha256 && report.reportId === formatReportId(actual);

  const inputs = validInputs(report.inputs);
  const settings = validSettings(report.settings);
  const scenarios = validScenarios(report.scenarios);
  if (!inputs || !settings || !scenarios)
    return {
      ok: false,
      hashMatches,
      calculationMatches: false,
      reason: "The inputs or scenarios in this report are not valid.",
    };

  let calculationMatches = false;
  try {
    calculationMatches =
      canonicalJson(scenarios.map((s) => runScenario(inputs, s, settings))) ===
      canonicalJson(report.results);
  } catch {
    calculationMatches = false;
  }

  return {
    ok: hashMatches && calculationMatches,
    hashMatches,
    calculationMatches,
    reason: !hashMatches
      ? "The fingerprint does not match. The report was changed after it was created."
      : !calculationMatches
        ? "The stored results do not match the calculation for the stored inputs."
        : undefined,
  };
}
