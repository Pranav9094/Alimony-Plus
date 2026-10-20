import type { LedgerRow, Order, Payment } from "./types";
import type { ArrearsRow } from "./arrears";
import { buildPdf, wrap, type PdfLine } from "./pdf";
import { sha256Hex } from "./receipt";

const rs = (n: number) => `Rs. ${n.toFixed(2)}`;
const col = (v: string | number, w: number) => String(v).padEnd(w).slice(0, w);

export type ExhibitInput = {
  asOf: string;
  synthetic: boolean;
  orders: Order[];
  ledger: LedgerRow[];
  arrears: ArrearsRow[];
  payments: Payment[];
};

// Court-exhibit style PDF: ledger, arrears (with paid dates) and payment
// records, ending with a SHA-256 fingerprint of the body text.
export async function buildExhibitPdf(input: ExhibitInput) {
  const body: PdfLine[] = [];
  const text = (t: string, bold = false) =>
    wrap(t).forEach((x) => body.push({ text: x, bold }));
  text("MAINTENANCE LEDGER - EXHIBIT", true);
  body[0].size = 15;
  text(`Position as of: ${input.asOf}`);
  if (input.synthetic)
    text("DEMONSTRATION DATA - synthetic, not a legal record.", true);
  text(
    "Prepared from records entered by the user. It has not been verified or certified by any court or authority.",
  );
  body.push({ text: "" });

  text("1. Court orders", true);
  input.orders.forEach((o) =>
    text(
      `Order #${o.id}  ${o.orderType ?? ""}  ${rs(o.amount)} per month  from ${o.effectiveDate ?? "n/a"}  due day ${o.dueDay ?? "n/a"}`,
    ),
  );
  body.push({ text: "" });

  text("2. Maintenance ledger", true);
  body.push({
    text: `${col("Period", 9)}${col("Due", 11)}${col("Expected", 15)}${col("Received", 15)}${col("Outstanding", 15)}Status`,
    bold: true,
  });
  input.ledger.forEach((r) =>
    body.push({
      text: `${col(r.period, 9)}${col(r.dueDate, 11)}${col(rs(r.expected), 15)}${col(rs(r.received), 15)}${col(rs(r.outstanding), 15)}${r.status}`,
    }),
  );
  body.push({ text: "" });

  text("3. Arrears and interest", true);
  body.push({
    text: `${col("Period", 9)}${col("Due", 11)}${col("Last paid", 11)}${col("Days", 6)}${col("Paid", 14)}${col("Unpaid", 14)}Interest`,
    bold: true,
  });
  input.arrears.forEach((r) =>
    body.push({
      text: `${col(r.period, 9)}${col(r.dueDate, 11)}${col(r.lastPaidOn ?? "none", 11)}${col(r.daysOverdue, 6)}${col(rs(r.paid), 14)}${col(rs(r.unpaid), 14)}${r.interest === null ? "Rule pending" : rs(r.interest)}`,
    }),
  );
  const total = input.arrears.reduce((s, r) => s + r.unpaid, 0);
  text(`Total unpaid: ${rs(total)}`, true);
  if (input.arrears.some((r) => r.interest === null))
    text(
      "Interest is not calculated: the approved interest rule has not been configured.",
    );
  body.push({ text: "" });

  text("4. Payment records", true);
  body.push({
    text: `${col("Received", 11)}${col("Order", 7)}${col("Period", 9)}${col("Amount", 15)}${col("Status", 10)}Proof SHA-256 (first 16)`,
    bold: true,
  });
  [...input.payments]
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
    .forEach((p) =>
      body.push({
        text: `${col(p.paymentDate.slice(0, 10), 11)}${col("#" + p.orderId, 7)}${col(p.period ?? "-", 9)}${col(rs(p.amount), 15)}${col(p.status, 10)}${p.proof ? p.proof.sha256.slice(0, 16) : "no proof"}`,
      }),
    );
  body.push({ text: "" });

  const fingerprint = await sha256Hex(body.map((l) => l.text).join("\n"));
  text("Document fingerprint (SHA-256 of the text above)", true);
  wrap(fingerprint, 80).forEach((x) => body.push({ text: x }));
  return {
    bytes: buildPdf(body, `Alimony+ exhibit ${input.asOf}`),
    fingerprint,
  };
}
