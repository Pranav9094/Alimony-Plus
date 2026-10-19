import type { SettlementReport } from "@/lib/settlement/fingerprint";

export async function downloadSettlementPdf(
  report: SettlementReport,
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 22;

  function addWatermarkAndFooter() {
    pdf.setTextColor(225, 225, 225);
    pdf.setFontSize(34);
    pdf.text("ILLUSTRATIVE", pageWidth / 2, pageHeight / 2, {
      align: "center",
      angle: 35,
    });

    pdf.setTextColor(90, 90, 90);
    pdf.setFontSize(7);
    pdf.text(`Report: ${report.reportId}`, margin, pageHeight - 12);
    pdf.text(
      `SHA-256: ${report.sha256.slice(0, 32)}...`,
      margin,
      pageHeight - 7,
    );
    pdf.text(
      "Planning only — not legal advice or a digital signature.",
      pageWidth - margin,
      pageHeight - 12,
      { align: "right" },
    );
  }

  function ensureSpace(requiredHeight = 12) {
    if (y + requiredHeight > pageHeight - 25) {
      addWatermarkAndFooter();
      pdf.addPage();
      y = 22;
    }
  }

  function heading(text: string) {
    ensureSpace(14);
    pdf.setTextColor(20, 50, 55);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(text, margin, y);
    y += 8;
  }

  function paragraph(text: string) {
    const lines = pdf.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 5 + 4);
    pdf.setTextColor(65, 75, 85);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  function money(value: number): string {
    return `INR ${new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(value)}`;
  }

  pdf.setProperties({
    title: "Alimony+ Settlement Studio Report",
    subject: "Illustrative financial settlement analysis",
    creator: "Alimony+ Settlement Studio",
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(15, 80, 75);
  pdf.text("Alimony+ Settlement Studio", margin, y);
  y += 10;

  pdf.setFontSize(14);
  pdf.setTextColor(35, 45, 55);
  pdf.text("Settlement Analysis Report", margin, y);
  y += 10;

  paragraph(`Report ID: ${report.reportId}`);
  paragraph(`Created: ${report.createdAt}`);
  paragraph(`Schema: ${report.schema}`);

  heading("Important disclaimer");
  paragraph(
    "This report provides illustrative financial planning only. It is not legal advice, a legal determination, a court prediction, or a digital signature. Verify all assumptions and applicable law with a qualified legal professional.",
  );

  heading("Financial inputs");
  paragraph(
    `Applicant monthly income: ${money(report.inputs.applicantIncome)}`,
  );
  paragraph(
    `Other party monthly income: ${money(report.inputs.respondentIncome)}`,
  );
  paragraph(
    `Applicant monthly expenses: ${money(report.inputs.applicantExpenses)}`,
  );
  paragraph(
    `Other party monthly expenses: ${money(report.inputs.respondentExpenses)}`,
  );
  paragraph(`Monthly child-related costs: ${money(report.inputs.childCosts)}`);

  heading("Settlement scenarios");

  for (const result of report.results) {
    ensureSpace(38);
    heading(result.label);

    paragraph(
      `Rule pack: ${result.rule.packName}. Applicant asset share: ${result.distribution.applicantSharePct.toFixed(2)}%.`,
    );
    paragraph(
      `Applicant assets: ${money(result.distribution.applicant.assets)}; debts: ${money(result.distribution.applicant.debts)}; net worth: ${money(result.distribution.applicant.netWorth)}.`,
    );
    paragraph(
      `Other party assets: ${money(result.distribution.respondent.assets)}; debts: ${money(result.distribution.respondent.debts)}; net worth: ${money(result.distribution.respondent.netWorth)}.`,
    );
    paragraph(
      `Applied monthly maintenance: ${money(result.maintenance.appliedMonthly)}; nominal total: ${money(result.maintenance.nominalTotal)}; present value: ${money(result.maintenance.presentValue)}.`,
    );

    if (result.rule.steps.length > 0) {
      heading("Rule calculation steps");

      for (const step of result.rule.steps) {
        const value =
          step.kind === "percent"
            ? `${step.value.toFixed(1)}%`
            : money(step.value);

        paragraph(`${step.label}: ${value}`);

        if (step.note) {
          paragraph(`Note: ${step.note}`);
        }
      }
    }
    if (result.warnings.length > 0) {
      heading("Scenario warnings");

      for (const warning of result.warnings) {
        paragraph(`Warning: ${warning}`);
      }
    }
  }

  heading("Report integrity fingerprint");
  paragraph(`Report ID: ${report.reportId}`);
  paragraph(`SHA-256: ${report.sha256}`);
  paragraph(
    "This hash helps detect changes to the report payload. It is not a digital signature and does not establish authenticity by itself.",
  );

  addWatermarkAndFooter();

  const filename = `settlement-report-${report.reportId.toLowerCase()}.pdf`;
  pdf.save(filename);
}
