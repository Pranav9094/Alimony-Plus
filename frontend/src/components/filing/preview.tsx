import { DRAFT_NOTICE, buildAffidavit } from "@/lib/filing/affidavit";
import type { FilingDraft } from "@/lib/filing/types";

export function AffidavitPreview({ draft }: { draft: FilingDraft }) {
  const sections = buildAffidavit(draft);
  return (
    <article className="f-paper" aria-label="Affidavit preview">
      {sections.map((section) => (
        <section
          key={section.heading}
          className={section.heading === "Title" ? "f-paper-title" : "f-paper-section"}
        >
          {section.heading !== "Title" ? <h3>{section.heading}</h3> : null}
          {section.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
      <p className="f-paper-note">{DRAFT_NOTICE}</p>
    </article>
  );
}