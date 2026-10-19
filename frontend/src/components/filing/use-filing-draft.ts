"use client";

import { useEffect, useReducer, useState } from "react";
import { emptyDraft } from "@/lib/filing/data";
import { clearDraft, hasDraftContent, loadDraft, saveDraft } from "@/lib/filing/storage";
import type {
  CauseOfActionId,
  CourtSelection,
  FilingDraft,
  FinancialDetails,
  Person,
  Role,
  StageId,
} from "@/lib/filing/types";

export type Action =
  | { type: "replace"; draft: FilingDraft }
  | { type: "reset" }
  | { type: "goto"; stage: StageId }
  | { type: "setRole"; role: Role }
  | { type: "setPerson"; who: "you" | "other"; field: keyof Person; value: string }
  | { type: "setCourt"; patch: Partial<CourtSelection> }
  | { type: "setCause"; cause: CauseOfActionId }
  | { type: "setAnswer"; id: string; value: string }
  | { type: "setFinancial"; patch: Partial<Omit<FinancialDetails, "documents">> }
  | { type: "toggleDocument"; id: string };

function reducer(state: FilingDraft, action: Action): FilingDraft {
  switch (action.type) {
    case "replace":
      return action.draft;
    case "reset":
      return emptyDraft();
    case "goto":
      return { ...state, stage: action.stage };
    case "setRole":
      return { ...state, role: action.role };
    case "setPerson":
      return {
        ...state,
        parties: {
          ...state.parties,
          [action.who]: { ...state.parties[action.who], [action.field]: action.value },
        },
      };
    case "setCourt":
      return { ...state, court: { ...state.court, ...action.patch } };
    case "setCause":
      return { ...state, causeOfAction: action.cause };
    case "setAnswer":
      return { ...state, answers: { ...state.answers, [action.id]: action.value } };
    case "setFinancial":
      return { ...state, financial: { ...state.financial, ...action.patch } };
    case "toggleDocument":
      return {
        ...state,
        financial: {
          ...state.financial,
          documents: state.financial.documents.map((d) =>
            d.id === action.id ? { ...d, available: !d.available } : d,
          ),
        },
      };
    default:
      return state;
  }
}

export type SaveStatus = "idle" | "saved" | "unavailable";

export function useFilingDraft() {
  const [draft, dispatch] = useReducer(reducer, null, () => emptyDraft());
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<FilingDraft | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    const found = loadDraft();
    if (found && hasDraftContent(found)) setPending(found);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || pending) return;
    const timer = window.setTimeout(() => {
      setSaveStatus(saveDraft(draft) ? "saved" : "unavailable");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, ready, pending]);

  function resume() {
    if (pending) {
      dispatch({ type: "replace", draft: pending });
      setPending(null);
    }
  }

  function startFresh() {
    clearDraft();
    dispatch({ type: "reset" });
    setPending(null);
  }

  return { draft, dispatch, ready, pending, resume, startFresh, saveStatus };
}