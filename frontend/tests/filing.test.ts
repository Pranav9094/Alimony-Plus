import { describe, expect, it } from "vitest";
import { buildAffidavit } from "../src/lib/filing/affidavit";
import { emptyDraft } from "../src/lib/filing/data";
import { STORAGE_KEY, loadDraft, saveDraft } from "../src/lib/filing/storage";
import { firstInvalidStage, isStageValid, validateStage } from "../src/lib/filing/validation";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("validation", () => {
  it("asks for a role on stage 1", () => {
    const d = emptyDraft();
    expect(validateStage(d, 1).role).toBeDefined();
    d.role = "petitioner";
    expect(isStageValid(d, 1)).toBe(true);
  });

  it("requires names, a valid age and an address on stage 2", () => {
    const d = emptyDraft();
    const errors = validateStage(d, 2);
    expect(errors["you.fullName"]).toBeDefined();
    expect(errors["you.age"]).toBeDefined();
    expect(errors["you.address"]).toBeDefined();
    expect(errors["other.fullName"]).toBeDefined();
    d.parties.you = { fullName: "A", age: "30", occupation: "", address: "Addr", phone: "" };
    d.parties.other.fullName = "B";
    expect(isStageValid(d, 2)).toBe(true);
  });

  it("rejects a district that does not belong to the state", () => {
    const d = emptyDraft();
    d.court = { state: "Gujarat", district: "Mumbai", courtType: "family-court" };
    d.causeOfAction = "interim-maintenance";
    expect(validateStage(d, 3)["court.district"]).toBeDefined();
    d.court.district = "Vadodara";
    expect(isStageValid(d, 3)).toBe(true);
  });

  it("asks different questions for petitioner and respondent", () => {
    const d = emptyDraft();
    d.causeOfAction = "interim-maintenance";
    d.role = "petitioner";
    expect(validateStage(d, 4)["answers.im-need"]).toBeDefined();
    expect(validateStage(d, 4)["answers.im-response"]).toBeUndefined();
    d.role = "respondent";
    expect(validateStage(d, 4)["answers.im-response"]).toBeDefined();
    expect(validateStage(d, 4)["answers.im-need"]).toBeUndefined();
  });

  it("rejects negative money on stage 5", () => {
    const d = emptyDraft();
    d.financial.monthlyIncome = "-5";
    expect(validateStage(d, 5)["financial.monthlyIncome"]).toBeDefined();
  });

  it("reports the first incomplete stage", () => {
    expect(firstInvalidStage(emptyDraft())).toBe(1);
  });
});

describe("storage", () => {
  it("saves and loads a draft", () => {
    const s = fakeStorage();
    const d = emptyDraft();
    d.role = "respondent";
    expect(saveDraft(d, s)).toBe(true);
    expect(loadDraft(s)?.role).toBe("respondent");
  });

  it("ignores damaged or outdated drafts", () => {
    const s = fakeStorage();
    s.setItem(STORAGE_KEY, "{not json");
    expect(loadDraft(s)).toBeNull();
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 999 }));
    expect(loadDraft(s)).toBeNull();
  });

  it("does not crash without storage", () => {
    expect(saveDraft(emptyDraft(), null)).toBe(false);
    expect(loadDraft(null)).toBeNull();
  });
});

describe("affidavit", () => {
  it("uses the entered name and marks empty fields", () => {
    const d = emptyDraft();
    d.role = "petitioner";
    d.parties.you.fullName = "Test Person";
    const text = buildAffidavit(d)
      .flatMap((s) => s.paragraphs)
      .join("\n");
    expect(text).toContain("Test Person");
    expect(text).toContain("[to be filled]");
  });
});