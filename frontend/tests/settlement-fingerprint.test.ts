import { describe, expect, it } from "vitest";
import {
  REPORT_SCHEMA,
  buildReport,
  canonicalJson,
  formatReportId,
  groupHash,
  sha256Hex,
  verifyReport,
  type SettlementReport,
} from "../src/lib/settlement/fingerprint";
import { DEFAULT_SETTINGS } from "../src/lib/settlement/engine";
import {
  createScenario,
  parseSettlementForm,
  sampleForm,
} from "../src/lib/settlement/schemas";

const NOW = new Date("2026-10-18T10:00:00Z");

async function sampleReport(now: Date = NOW): Promise<SettlementReport> {
  const parsed = parseSettlementForm(sampleForm());
  if (!parsed.ok) throw new Error("sample form must be valid");
  return buildReport({
    inputs: parsed.data,
    settings: DEFAULT_SETTINGS,
    scenarios: [
      createScenario("s1", "Base", { monthlyAmount: 9000 }),
      createScenario("s2", "Alt", {
        splitPctApplicant: 70,
        monthlyAmount: 5000,
        packId: "income-equalisation",
      }),
    ],
    now,
  });
}

/** What a saved and re-opened file looks like. */
const roundTrip = (report: SettlementReport) =>
  JSON.parse(JSON.stringify(report)) as SettlementReport;

/** Recompute the fingerprint after an edit, as someone covering their tracks would. */
async function rehash(report: SettlementReport): Promise<SettlementReport> {
  const payload: Partial<SettlementReport> = { ...report };
  delete payload.sha256;
  delete payload.reportId;
  const sha256 = await sha256Hex(canonicalJson(payload));
  return { ...report, sha256, reportId: formatReportId(sha256) };
}

describe("hashing", () => {
  it("matches the published SHA-256 test values", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex("The quick brown fox jumps over the lazy dog")).toBe(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    );
  });

  it("writes the same text for the same content, in any key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      canonicalJson({ a: { c: [3, { y: 2, z: 1 }], d: 2 }, b: 1 }),
    );
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(canonicalJson([1, "x", null, true])).toBe('[1,"x",null,true]');
  });

  it("refuses values it cannot fingerprint", () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => canonicalJson({ a: () => 1 })).toThrow();
    expect(() => canonicalJson({ a: BigInt(1) })).toThrow();
  });

  it("builds a readable id and hash groups", async () => {
    const hash = await sha256Hex("abc");
    expect(formatReportId(hash)).toBe("STU-BA78-16BF-8F01");
    const groups = groupHash(hash);
    expect(groups).toHaveLength(8);
    expect(groups.every((g) => g.length === 8)).toBe(true);
    expect(groups.join("")).toBe(hash);
    expect(groupHash("abcdef", 4)).toEqual(["abcd", "ef"]);
  });
});

describe("building a report", () => {
  it("gives the same fingerprint for the same content and time", async () => {
    const a = await sampleReport();
    const b = await sampleReport();
    expect(a.sha256).toBe(b.sha256);
    expect(a.reportId).toBe(b.reportId);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a.reportId).toMatch(/^STU-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(a.reportId).toBe(formatReportId(a.sha256));
  });

  it("changes when the time or any input changes", async () => {
    const base = await sampleReport();
    const later = await sampleReport(new Date("2026-10-18T10:00:01Z"));
    expect(later.sha256).not.toBe(base.sha256);

    const parsed = parseSettlementForm({ ...sampleForm(), childCosts: "5001" });
    if (!parsed.ok) throw new Error("form must be valid");
    const changed = await buildReport({
      inputs: parsed.data,
      settings: DEFAULT_SETTINGS,
      scenarios: base.scenarios,
      now: NOW,
    });
    expect(changed.sha256).not.toBe(base.sha256);
  });

  it("stores one result per scenario and a schema name", async () => {
    const report = await sampleReport();
    expect(report.schema).toBe(REPORT_SCHEMA);
    expect(report.createdAt).toBe("2026-10-18T10:00:00.000Z");
    expect(report.results.map((r) => r.scenarioId)).toEqual(["s1", "s2"]);
  });
});

describe("verifying a report", () => {
  it("accepts an untouched report, even after saving and reopening it", async () => {
    const report = await sampleReport();
    expect(await verifyReport(report)).toEqual({
      ok: true,
      hashMatches: true,
      calculationMatches: true,
      reason: undefined,
    });
    const reopened = await verifyReport(roundTrip(report));
    expect(reopened.ok).toBe(true);
  });

  it("does not care about the order of keys in the saved file", async () => {
    const report = await sampleReport();
    const reversed = Object.fromEntries(Object.entries(report).reverse());
    expect((await verifyReport(reversed)).ok).toBe(true);
  });

  it("catches an edited result", async () => {
    const copy = roundTrip(await sampleReport());
    copy.results[0].applicantTotal += 1;
    const result = await verifyReport(copy);
    expect(result.ok).toBe(false);
    expect(result.hashMatches).toBe(false);
    expect(result.reason).toMatch(/changed after it was created/);
  });

  it("catches an edited result even when the fingerprint is recomputed", async () => {
    const copy = roundTrip(await sampleReport());
    copy.results[0].applicantTotal += 1;
    const result = await verifyReport(await rehash(copy));
    expect(result.ok).toBe(false);
    expect(result.hashMatches).toBe(true);
    expect(result.calculationMatches).toBe(false);
    expect(result.reason).toMatch(/do not match the calculation/);
  });

  it("catches an edited input", async () => {
    const copy = roundTrip(await sampleReport());
    copy.inputs.respondentIncome = 1;
    expect((await verifyReport(copy)).hashMatches).toBe(false);
    expect((await verifyReport(await rehash(copy))).calculationMatches).toBe(
      false,
    );
  });

  it("catches an edited scenario, report id or time", async () => {
    const base = await sampleReport();
    const scenario = roundTrip(base);
    scenario.scenarios[0].splitPctApplicant = 99;
    expect((await verifyReport(scenario)).ok).toBe(false);

    const id = roundTrip(base);
    id.reportId = "STU-0000-0000-0000";
    expect((await verifyReport(id)).hashMatches).toBe(false);

    const time = roundTrip(base);
    time.createdAt = "2026-10-19T10:00:00.000Z";
    expect((await verifyReport(time)).hashMatches).toBe(false);
  });

  it("explains when stored inputs break the rules", async () => {
    const copy = roundTrip(await sampleReport());
    copy.inputs.applicantIncome = -5;
    const result = await verifyReport(await rehash(copy));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not valid/);
  });

  it("rejects settings that are not usable", async () => {
    const copy = roundTrip(await sampleReport()) as unknown as Record<
      string,
      unknown
    >;
    copy.settings = { jurisdictionId: 5 };
    expect((await verifyReport(copy)).ok).toBe(false);
  });

  it("rejects things that are not reports", async () => {
    for (const junk of [null, undefined, 5, "text", [], {}, { schema: "other" }])
      expect((await verifyReport(junk)).ok).toBe(false);
    const result = await verifyReport({ schema: "other" });
    expect(result.reason).toMatch(/does not look like a Settlement Studio report/);
  });
});