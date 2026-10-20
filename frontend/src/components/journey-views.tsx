"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, FolderHeart, Phone, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, Empty, ExternalLink, PageHeading } from "./ui";
import { useWorkspace } from "./workspace-provider";

type Intake = {
  relationshipStatus: string;
  marriageType: string;
  pendingProceedings: string[];
  hasDependentChildren: string;
  ownIncome: string;
  respondentMeans: string;
  supportStatus: string;
  safetyRisk: string;
  location: string;
};
const blank: Intake = {
  relationshipStatus: "unknown",
  marriageType: "unknown",
  pendingProceedings: ["unknown"],
  hasDependentChildren: "unknown",
  ownIncome: "unknown",
  respondentMeans: "unknown",
  supportStatus: "unknown",
  safetyRisk: "unknown",
  location: "",
};
const IDK = { value: "unknown", label: "I don’t know" };
const questions: {
  key: Exclude<keyof Intake, "pendingProceedings" | "location">;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "relationshipStatus",
    label: "Are you currently married, separated or divorced?",
    options: [
      { value: "married", label: "Married" },
      { value: "separated", label: "Separated" },
      { value: "divorced", label: "Divorced" },
      { value: "other", label: "Something else" },
      IDK,
    ],
  },
  {
    key: "marriageType",
    label: "How was the marriage solemnized or registered?",
    options: [
      { value: "hindu_rites", label: "Hindu rites" },
      { value: "special_marriage_act", label: "Registered under the Special Marriage Act" },
      { value: "muslim_nikah", label: "Muslim nikah" },
      { value: "other", label: "Another way" },
      IDK,
    ],
  },
  {
    key: "hasDependentChildren",
    label: "Do you have dependent children?",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, IDK],
  },
  {
    key: "ownIncome",
    label: "Do you have your own income or assets?",
    options: [
      { value: "some", label: "Yes, some" },
      { value: "none", label: "No" },
      IDK,
    ],
  },
  {
    key: "respondentMeans",
    label: "What do you know about your spouse’s income and assets?",
    options: [
      { value: "known", label: "I know most of it" },
      { value: "partly", label: "I know some of it" },
      IDK,
    ],
  },
  {
    key: "supportStatus",
    label: "Are you receiving any support, or is there already a court order?",
    options: [
      { value: "receiving", label: "Receiving some support, no order" },
      { value: "order_exists", label: "A court order already exists" },
      { value: "none", label: "Neither" },
      IDK,
    ],
  },
  {
    key: "safetyRisk",
    label: "Is there domestic violence or an immediate safety risk?",
    options: [
      { value: "immediate", label: "Yes, I am in immediate danger" },
      { value: "yes", label: "Yes, violence or threats, but not immediate" },
      { value: "no", label: "No" },
      { value: "unknown", label: "I’d rather not say" },
    ],
  },
];
const pendingOptions = [
  { value: "matrimonial", label: "A divorce or other matrimonial case" },
  { value: "dv", label: "A domestic-violence case" },
  { value: "maintenance", label: "A maintenance case" },
  { value: "none", label: "No case is pending" },
  IDK,
];
const answerable = (a: Intake) =>
  questions.filter((q) => a[q.key] !== "unknown").length +
  (a.pendingProceedings.some((p) => p !== "unknown") ? 1 : 0) +
  (a.location ? 1 : 0);

function useJourneyCase() {
  const { data, demo, selectedCase, setSelectedCase } = useWorkspace();
  const caseId =
    data.cases.find((c) => c.id === selectedCase)?.id || data.cases[0]?.id || 0;
  return { data, demo, caseId, setSelectedCase };
}
function JourneyGate({
  demo,
  hasCase,
  children,
}: {
  demo: boolean;
  hasCase: boolean;
  children: React.ReactNode;
}) {
  if (demo)
    return (
      <Empty
        title="Sign in to use this step"
        action={
          <Link className="button primary" href="/login">
            Connect your account
          </Link>
        }
      >
        Your answers are saved privately to your own case, so this step needs a
        signed-in workspace. The demo workspace does not store them.
      </Empty>
    );
  if (!hasCase)
    return (
      <Empty
        title="Create a case first"
        action={
          <Link className="button primary" href="/cases">
            Go to my cases
          </Link>
        }
      >
        Each case has its own answers, legal routes and checklist.
      </Empty>
    );
  return <>{children}</>;
}
function CasePicker({
  caseId,
  setSelected,
}: {
  caseId: number;
  setSelected: (id: number) => void;
}) {
  const { data } = useWorkspace();
  if (data.cases.length < 2) return null;
  return (
    <label className="case-selector">
      <FolderHeart size={15} />
      <select
        aria-label="Choose case"
        value={caseId}
        onChange={(e) => setSelected(Number(e.target.value))}
      >
        {data.cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}

export function IntakeView() {
  const { data, demo, caseId, setSelectedCase } = useJourneyCase();
  const { setNotice } = useWorkspace();
  const router = useRouter();
  const [answers, setAnswers] = useState<Intake>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (demo || !caseId) return;
    let live = true;
    api<{ intake: { answers: Intake } }>(`cases/${caseId}/intake`)
      .then((r) => live && setAnswers({ ...blank, ...r.intake.answers }))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [caseId, demo]);
  const set = (patch: Partial<Intake>) => setAnswers((a) => ({ ...a, ...patch }));
  function togglePending(value: string) {
    const current = answers.pendingProceedings;
    let next: string[];
    if (value === "none" || value === "unknown") next = [value];
    else {
      const base = current.filter((p) => p !== "none" && p !== "unknown");
      next = base.includes(value)
        ? base.filter((p) => p !== value)
        : [...base, value];
    }
    set({ pendingProceedings: next.length ? next : ["unknown"] });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`cases/${caseId}/intake`, answers);
      setNotice("Your answers are saved. Here are the legal routes that may apply.");
      router.push("/navigator");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const done = answerable(answers);
  return (
    <>
      <PageHeading
        eyebrow="START HERE"
        title="Tell us where things stand."
        description="A few simple questions help us show the routes that may apply. “I don’t know” is always okay."
      >
        <CasePicker caseId={caseId} setSelected={setSelectedCase} />
      </PageHeading>
      <JourneyGate demo={demo} hasCase={data.cases.length > 0}>
        <form className="panel" onSubmit={save} noValidate>
          <div className="panel-heading">
            <div>
              <h2>Guided intake</h2>
              <p>
                {done} of {questions.length + 2} answered · saved only when you
                press Save.
              </p>
            </div>
          </div>
          {(answers.safetyRisk === "immediate" ||
            answers.safetyRisk === "yes") && (
            <div className="callout warning" role="alert">
              <strong>Your safety comes first.</strong> If you are in immediate
              danger, call 112 or the NALSA legal-aid helpline 15100. You can
              finish this form later.
            </div>
          )}
          {questions.slice(0, 2).map((q) => (
            <Question key={q.key} q={q} answers={answers} set={set} />
          ))}
          <fieldset className="field">
            <legend>Is any case already pending? (choose all that apply)</legend>
            {pendingOptions.map((o) => (
              <label key={o.value} className="choice">
                <input
                  type="checkbox"
                  checked={answers.pendingProceedings.includes(o.value)}
                  onChange={() => togglePending(o.value)}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
          {questions.slice(2).map((q) => (
            <Question key={q.key} q={q} answers={answers} set={set} />
          ))}
          <div className="field">
            <label htmlFor="intake-location">
              Where are you located? (city or state)
            </label>
            <input
              id="intake-location"
              value={answers.location}
              maxLength={80}
              pattern="[\p{L}\p{N} .,'\-]{0,80}"
              autoComplete="off"
              onChange={(e) => set({ location: e.target.value })}
            />
            <small>Used to point you to the right legal-aid office.</small>
          </div>
          {error && (
            <div className="callout warning" role="alert">
              {error}
            </div>
          )}
          <div className="panel-footnote">
            <ShieldCheck size={15} /> Only these answers are stored, and only in
            your own case.
          </div>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : "Save and see my legal routes"}
          </button>
        </form>
      </JourneyGate>
    </>
  );
}
function Question({
  q,
  answers,
  set,
}: {
  q: (typeof questions)[number];
  answers: Intake;
  set: (p: Partial<Intake>) => void;
}) {
  return (
    <fieldset className="field">
      <legend>{q.label}</legend>
      {q.options.map((o) => (
        <label key={o.value} className="choice">
          <input
            type="radio"
            name={q.key}
            value={o.value}
            checked={answers[q.key] === o.value}
            onChange={() => set({ [q.key]: o.value } as Partial<Intake>)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

type Route = {
  id: string;
  title: string;
  explainer: string;
  reasons: string[];
  questionsForCounsel: string[];
  source: { title: string; url: string; effectiveFrom: string | null; reviewedOn: string; reviewStatus: string };
};
type Navigator = {
  safetyFirst: boolean;
  safety: { title: string; message: string; contacts: { label: string; value: string }[]; note: string } | null;
  routes: Route[];
  needsMoreInfo: string[];
  overlapWarning: string | null;
  existingOrderNote: string | null;
  legalAid: { title: string; helpline: string; explainer: string; source: Route["source"] };
  disclaimer: string;
};
const safeUrl = (url: string) => (/^https:\/\//.test(url) ? url : "");

export function NavigatorView() {
  const { data, demo, caseId, setSelectedCase } = useJourneyCase();
  const [nav, setNav] = useState<Navigator | null>(null);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (demo || !caseId) return;
    let live = true;
    setNav(null);
    setError("");
    api<{ navigator: Navigator; intakeSaved: boolean }>(`cases/${caseId}/navigator`)
      .then((r) => {
        if (!live) return;
        setNav(r.navigator);
        setSaved(r.intakeSaved);
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [caseId, demo]);
  return (
    <>
      <PageHeading
        eyebrow="LEGAL ROUTES"
        title="Routes that may apply to you."
        description="Based on your answers. These are possibilities to discuss with a lawyer, not a decision about what you are owed."
      >
        <CasePicker caseId={caseId} setSelected={setSelectedCase} />
      </PageHeading>
      <JourneyGate demo={demo} hasCase={data.cases.length > 0}>
        {error && (
          <div className="callout warning" role="alert">
            {error}
          </div>
        )}
        {!saved && (
          <div className="callout">
            You haven’t answered the intake questions yet, so these routes are
            general. <Link href="/intake">Answer them now</Link> to narrow them
            down.
          </div>
        )}
        {nav?.safetyFirst && nav.safety && (
          <section className="panel" role="alert">
            <h2>
              <CircleAlert size={18} /> {nav.safety.title}
            </h2>
            <p>{nav.safety.message}</p>
            {nav.safety.contacts.map((c) => (
              <p key={c.label}>
                <Phone size={14} /> {c.label}: <strong>{c.value}</strong>
              </p>
            ))}
            <p className="small muted">{nav.safety.note}</p>
          </section>
        )}
        {nav && (
          <>
            {nav.overlapWarning && (
              <div className="callout warning">{nav.overlapWarning}</div>
            )}
            {nav.existingOrderNote && (
              <div className="callout">{nav.existingOrderNote}</div>
            )}
            {nav.needsMoreInfo.length > 0 && (
              <div className="callout">
                Your marriage type or current status is unclear, so more routes
                may apply. A lawyer can help narrow them down.
              </div>
            )}
            {nav.routes.map((r) => (
              <section className="panel" key={r.id}>
                <div className="panel-heading">
                  <div>
                    <h2>{r.title}</h2>
                    <p>{r.explainer}</p>
                  </div>
                  <Badge tone="amber">Possible route</Badge>
                </div>
                <p className="small">
                  <strong>Why it’s shown:</strong> {r.reasons.join(" ")}
                </p>
                <p className="small">
                  <strong>Questions to ask a lawyer</strong>
                </p>
                <ul className="small">
                  {r.questionsForCounsel.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <p className="small muted">
                  Source: {r.source.title}
                  {r.source.effectiveFrom ? ` · effective ${r.source.effectiveFrom}` : ""}{" "}
                  · reviewed {r.source.reviewedOn} · awaiting legal review{" "}
                  {safeUrl(r.source.url) && (
                    <ExternalLink href={r.source.url}>Open source</ExternalLink>
                  )}
                </p>
              </section>
            ))}
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>{nav.legalAid.title}</h2>
                  <p>{nav.legalAid.explainer}</p>
                </div>
                <Badge>Helpline {nav.legalAid.helpline}</Badge>
              </div>
              {safeUrl(nav.legalAid.source.url) && (
                <ExternalLink href={nav.legalAid.source.url}>
                  NALSA: assistance for women
                </ExternalLink>
              )}
            </section>
            <p className="small muted">{nav.disclaimer}</p>
          </>
        )}
      </JourneyGate>
    </>
  );
}

type ChecklistItem = {
  key: string;
  label: string;
  examples: string[];
  priority: string;
  added: number;
  status: "added" | "to_add";
  note?: string;
};
export function ReadinessChecklist({
  caseId,
  refreshKey,
  onAdd,
}: {
  caseId: number;
  refreshKey: number;
  onAdd: () => void;
}) {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [guidance, setGuidance] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await api<{
        checklist: { items: ChecklistItem[]; guidance: string };
      }>(`cases/${caseId}/checklist`);
      setItems(r.checklist.items);
      setGuidance(r.checklist.guidance);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [caseId]);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  return (
    <section className="panel readiness-panel">
      <h2>Your readiness checklist</h2>
      <p className="muted">
        Built from your intake answers. Nothing here is verified automatically.
      </p>
      {error && (
        <div className="callout warning" role="alert">
          {error}
        </div>
      )}
      {items?.map((item) => (
        <div className="checklist-item" key={item.key}>
          <span className={item.added ? "check-circle done" : "check-circle"}>
            {item.added > 0 && <Check size={12} />}
          </span>
          <div>
            <strong>{item.label}</strong>
            <small>
              {item.added
                ? `${item.added} added · not verified`
                : item.priority === "start"
                  ? "A good place to start"
                  : "Add if relevant and available"}
              {" · "}
              {item.examples.join(", ")}
            </small>
            {item.note && <small>{item.note}</small>}
          </div>
        </div>
      ))}
      <p className="small muted mt-5">{guidance}</p>
      <button className="button secondary" onClick={onAdd}>
        Add a document
      </button>
    </section>
  );
}
