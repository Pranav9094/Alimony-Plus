import { DEFAULT_SETTINGS, type EngineSettings } from "./engine";
import {
  AMOUNT_FIELDS,
  LIMITS,
  OWNERS,
  createScenario,
  emptyForm,
  parseScenario,
  sampleForm,
  type Owner,
  type Scenario,
  type SettlementFormValues,
} from "./schemas";

export const STUDIO_STORAGE_KEY = "alimonyplus.settlement.v1";
export const MAX_SCENARIOS = 3;

export type StudioState = {
  form: SettlementFormValues;
  scenarios: Scenario[];
  settings: EngineSettings;
};

/** Starting point: sample numbers and three scenarios that show a real trade-off. */
export function defaultStudioState(): StudioState {
  return {
    form: sampleForm(),
    scenarios: [
      createScenario("scenario-1", "Scenario A", {
        splitPctApplicant: 50,
        monthlyAmount: 9000,
        years: 5,
      }),
      createScenario("scenario-2", "Scenario B", {
        splitPctApplicant: 60,
        monthlyAmount: 6000,
        years: 5,
      }),
      createScenario("scenario-3", "Scenario C", {
        poolScope: "all-assets",
        splitPctApplicant: 50,
        monthlyAmount: 9000,
        years: 3,
      }),
    ],
    settings: { ...DEFAULT_SETTINGS, paramOverrides: {} },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

function cleanRows(value: unknown, prefix: string) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: SettlementFormValues["assets"] = [];
  for (const [index, row] of value.entries()) {
    if (!isRecord(row) || rows.length >= LIMITS.maxRows) continue;
    let id =
      typeof row.id === "string" && row.id ? row.id : `${prefix}-${index + 1}`;
    while (seen.has(id)) id = `${id}-x`;
    seen.add(id);
    rows.push({
      id,
      label: typeof row.label === "string" ? row.label : "",
      owner: (OWNERS as readonly unknown[]).includes(row.owner)
        ? (row.owner as Owner)
        : "joint",
      value: text(row.value),
    });
  }
  return rows;
}

function cleanForm(value: unknown): SettlementFormValues {
  if (!isRecord(value)) return sampleForm();
  const form = emptyForm();
  for (const [key] of AMOUNT_FIELDS) form[key] = text(value[key]);
  form.assets = cleanRows(value.assets, "asset");
  form.debts = cleanRows(value.debts, "debt");
  return form;
}

function cleanScenarios(value: unknown): Scenario[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Scenario[] = [];
  for (const item of value) {
    const parsed = parseScenario(item);
    if (!parsed.ok || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    out.push(parsed.data);
    if (out.length >= MAX_SCENARIOS) break;
  }
  return out;
}

function cleanSettings(value: unknown): EngineSettings {
  const fallback: EngineSettings = { ...DEFAULT_SETTINGS, paramOverrides: {} };
  if (!isRecord(value)) return fallback;
  const overrides: EngineSettings["paramOverrides"] = {};
  if (isRecord(value.paramOverrides))
    for (const [packId, params] of Object.entries(value.paramOverrides)) {
      if (!isRecord(params)) continue;
      const inner: Record<string, number> = {};
      for (const [key, n] of Object.entries(params))
        if (typeof n === "number" && Number.isFinite(n)) inner[key] = n;
      if (Object.keys(inner).length) overrides[packId] = inner;
    }
  return {
    jurisdictionId:
      typeof value.jurisdictionId === "string" && value.jurisdictionId
        ? value.jurisdictionId
        : fallback.jurisdictionId,
    paramOverrides: overrides,
  };
}

/** Turns saved text into a usable state. Bad or old data never throws. */
export function parseStudioState(raw: string | null): StudioState {
  if (!raw) return defaultStudioState();
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return defaultStudioState();
    const scenarios = cleanScenarios(data.scenarios);
    return {
      form: cleanForm(data.form),
      scenarios: scenarios.length ? scenarios : defaultStudioState().scenarios,
      settings: cleanSettings(data.settings),
    };
  } catch {
    return defaultStudioState();
  }
}

export function loadStudioState(): StudioState {
  if (typeof window === "undefined") return defaultStudioState();
  try {
    return parseStudioState(window.localStorage.getItem(STUDIO_STORAGE_KEY));
  } catch {
    return defaultStudioState();
  }
}

export function saveStudioState(state: StudioState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: the studio still works, it just is not saved
  }
}

export function clearStudioState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STUDIO_STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

export function nextScenarioId(scenarios: readonly Scenario[]): string {
  const used = new Set(scenarios.map((s) => s.id));
  for (let n = 1; ; n++) {
    const id = `scenario-${n}`;
    if (!used.has(id)) return id;
  }
}

function nextScenarioLabel(scenarios: readonly Scenario[]): string {
  const used = new Set(scenarios.map((s) => s.label));
  for (const letter of "ABCDEFGH") {
    const label = `Scenario ${letter}`;
    if (!used.has(label)) return label;
  }
  return `Scenario ${scenarios.length + 1}`;
}

/** Adds a copy of the last scenario (or `template`). Does nothing at the limit. */
export function addScenario(
  scenarios: readonly Scenario[],
  template?: Scenario,
): Scenario[] {
  if (scenarios.length >= MAX_SCENARIOS) return [...scenarios];
  const base =
    template ??
    scenarios[scenarios.length - 1] ??
    createScenario("scenario-1", "Scenario A");
  return [
    ...scenarios,
    {
      ...base,
      id: nextScenarioId(scenarios),
      label: nextScenarioLabel(scenarios),
    },
  ];
}

/** Removes a scenario but always keeps at least one. */
export function removeScenario(
  scenarios: readonly Scenario[],
  id: string,
): Scenario[] {
  if (scenarios.length <= 1) return [...scenarios];
  return scenarios.filter((s) => s.id !== id);
}

export function updateScenario(
  scenarios: readonly Scenario[],
  id: string,
  patch: Partial<Omit<Scenario, "id">>,
): Scenario[] {
  return scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s));
}