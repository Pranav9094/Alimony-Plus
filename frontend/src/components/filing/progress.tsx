import { Check } from "lucide-react";
import { STAGES } from "@/lib/filing/types";
import type { StageId } from "@/lib/filing/types";

export function Progress({ current }: { current: StageId }) {
  const active = STAGES.find((s) => s.id === current);
  const percent = Math.round((current / STAGES.length) * 100);
  return (
    <nav aria-label="Filing progress" className="f-progress">
      <p className="f-stage-count">
        Stage {current} of {STAGES.length}: {active?.title}
      </p>
      <div className="f-bar" aria-hidden="true">
        <div className="f-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <ol className="f-steps">
        {STAGES.map((s) => {
          const state = s.id < current ? "done" : s.id === current ? "current" : "todo";
          return (
            <li
              key={s.id}
              className="f-step"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="f-dot" aria-hidden="true">
                {state === "done" ? <Check size={14} /> : s.id}
              </span>
              <span className="f-step-label">
                {s.shortTitle}
                {state === "done" ? <span className="f-sr"> (completed)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}