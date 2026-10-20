"use client";
import { useEffect, useState } from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Field, Modal } from "./ui";

type SaveState = "saved" | "saving" | "error";

export function NotesDialog({ caseId, onClose }: { caseId: number; onClose: () => void }) {
  const { data, caseNotes, setCaseNote } = useWorkspace();
  const [draft, setDraft] = useState(caseNotes[caseId] || "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const title = data.cases.find((item) => item.id === caseId)?.title || `Case #${caseId}`;
  useEffect(() => {
    if (saveState !== "saving") return;
    const timeout = setTimeout(() => setSaveState("saved"), 400);
    return () => clearTimeout(timeout);
  }, [draft, saveState]);
  function update(value: string) {
    setDraft(value);
    try {
      setCaseNote(caseId, value);
      setSaveState("saving");
    } catch {
      setSaveState("error");
    }
  }
  return (
    <Modal title="Case notes" description={`${title} · private working notes`} onClose={onClose}>
      <div className="notes-status" role="status" aria-live="polite">
        {saveState === "saving" ? <><LoaderCircle size={15} className="animate-spin" />Saving…</> : saveState === "error" ? <><CircleAlert size={15} />Could not save this note</> : <><Check size={15} />Saved to this session</>}
      </div>
      <Field label="Notes">
        <textarea aria-label="Case notes" rows={9} maxLength={3000} value={draft} onChange={(event) => update(event.target.value)} placeholder="Add a private reminder or a question to discuss with your legal professional." />
      </Field>
      <div className="notes-foot"><span>Autosaved in this session · {draft.length}/3000</span><span>Notes are not sent to the case service and clear on refresh.</span></div>
    </Modal>
  );
}