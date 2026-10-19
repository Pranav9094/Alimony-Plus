"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { STAGES, type StageId } from "@/lib/filing/types";
import { isStageValid, validateStage } from "@/lib/filing/validation";
import { AffidavitPreview } from "./preview";
import { Progress } from "./progress";
import { StageParties } from "./stage-parties";
import { StageCourt } from "./stage-court";
import { StageQuestions } from "./stage-questions";
import { StageFinancial } from "./stage-financial";
import { StageReview } from "./stage-review";
import { StageRole } from "./stage-role";
import { useFilingDraft } from "./use-filing-draft";

export function Wizard() {
  const { draft, dispatch, ready, pending, resume, startFresh, saveStatus } = useFilingDraft();
  const [attempted, setAttempted] = useState(false);
  const [tab, setTab] = useState<"form" | "preview">("form");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const stage = draft.stage;
  const info = STAGES.find((s) => s.id === stage);
  const errors = attempted ? validateStage(draft, stage) : {};
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stage]);

  function go(to: StageId) {
    setAttempted(false);
    dispatch({ type: "goto", stage: to });
  }

  function next() {
    if (!isStageValid(draft, stage)) {
      setAttempted(true);
      return;
    }
    if (stage < 6) go((stage + 1) as StageId);
  }

  function back() {
    if (stage > 1) go((stage - 1) as StageId);
  }

  if (!ready) {
    return (
      <div className="filing-inner">
        <p role="status">Loading your filing studio...</p>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="filing-inner">
        <section className="f-card f-resume" aria-labelledby="resume-title">
          <h1 id="resume-title">Resume your draft?</h1>
          <p>
            We found a draft saved on this device
            {pending.updatedAt
              ? ` (last saved ${new Date(pending.updatedAt).toLocaleString("en-IN")})`
              : ""}
            . You can continue where you stopped, or start again.
          </p>
          <div className="f-nav">
            <button type="button" className="f-btn f-btn-primary" onClick={resume} autoFocus>
              Resume draft
            </button>
            <button type="button" className="f-btn f-btn-secondary" onClick={startFresh}>
              Start fresh
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="filing-inner">
      <div className="f-top">
        <Link href="/dashboard" className="f-backlink">
          <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
        </Link>
        <p className="f-save" aria-live="polite">
          {saveStatus === "saved"
            ? "Draft saved on this device"
            : saveStatus === "unavailable"
              ? "Auto-save is unavailable in this browser. Your changes are not being saved."
              : ""}
        </p>
      </div>

      <h1 className="f-title">File a new case</h1>
      <p className="f-notice">
        Draft helper, not legal advice. The court and case-type lists are sample data.
      </p>

      <Progress current={stage} />

      <div className="f-tabs" role="group" aria-label="Choose what to show">
        <button
          type="button"
          className="f-tab"
          aria-pressed={tab === "form"}
          onClick={() => setTab("form")}
        >
          Form
        </button>
        <button
          type="button"
          className="f-tab"
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>

      <div className="f-grid" data-tab={tab}>
        <section className="f-form-col f-card" aria-labelledby="stage-heading">
          <h2 id="stage-heading" tabIndex={-1} ref={headingRef} className="f-stage-title">
            {info?.title}
          </h2>

          {errorCount > 0 ? (
            <div className="f-summary" role="alert">
              Please fix {errorCount} {errorCount === 1 ? "item" : "items"} below before
              continuing.
            </div>
          ) : null}

          <div key={stage} className="f-stage">
            {stage === 1 ? (
              <StageRole
                role={draft.role}
                error={errors.role}
                onChange={(role) => dispatch({ type: "setRole", role })}
              />
            ) : null}
            {stage === 2 ? (
              <StageParties parties={draft.parties} errors={errors} dispatch={dispatch} />
            ) : null}
            {stage === 3 ? (
              <StageCourt
                court={draft.court}
                causeOfAction={draft.causeOfAction}
                errors={errors}
                dispatch={dispatch}
              />
            ) : null}
            {stage === 4 ? (
              <StageQuestions draft={draft} errors={errors} dispatch={dispatch} />
            ) : null}
            {stage === 5 ? (
              <StageFinancial financial={draft.financial} errors={errors} dispatch={dispatch} />
            ) : null}
            {stage === 6 ? <StageReview draft={draft} onEdit={go} /> : null}
            {stage > 6 ? (
              <p className="f-placeholder">This stage is built in the next step of the project.</p>
            ) : null}
          </div>

          <div className="f-nav">
            <button
              type="button"
              className="f-btn f-btn-secondary"
              onClick={back}
              disabled={stage === 1}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
            {stage < 6 ? (
              <button type="button" className="f-btn f-btn-primary" onClick={next}>
                Next <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </section>

        <aside className="f-preview-col" aria-label="Live affidavit preview">
          <h2 className="f-preview-title">Live preview</h2>
          <AffidavitPreview draft={draft} />
        </aside>
      </div>
    </div>
  );
}