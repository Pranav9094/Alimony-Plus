import { emptyDraft } from "./data";
import { DRAFT_VERSION } from "./types";
import type { FilingDraft } from "./types";

export const STORAGE_KEY = "alimony-plus:filing-draft";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDraft(value: unknown): value is FilingDraft {
  if (!isRecord(value)) return false;
  if (value.version !== DRAFT_VERSION) return false;
  if (typeof value.stage !== "number" || value.stage < 1 || value.stage > 6) return false;
  const parties = value.parties;
  const court = value.court;
  const answers = value.answers;
  const financial = value.financial;
  if (!isRecord(parties) || !isRecord(parties.you) || !isRecord(parties.other)) return false;
  if (!isRecord(court) || !isRecord(answers) || !isRecord(financial)) return false;
  return Array.isArray(financial.documents);
}

export function saveDraft(
  draft: FilingDraft,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    const stamped: FilingDraft = { ...draft, updatedAt: new Date().toISOString() };
    storage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(
  storage: StorageLike | null = browserStorage(),
): FilingDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

export function hasDraftContent(draft: FilingDraft): boolean {
  const blank = emptyDraft();
  return (
    draft.role !== blank.role ||
    draft.parties.you.fullName.trim() !== "" ||
    draft.parties.other.fullName.trim() !== "" ||
    draft.causeOfAction !== "" ||
    Object.keys(draft.answers).length > 0
  );
}