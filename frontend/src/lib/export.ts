import type { LedgerRow, Payment } from "./types";
import type { ArrearsRow } from "./arrears";

// Quote every cell; neutralise spreadsheet formulas typed into free-text fields.
const cell = (value: string | number) => {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export function toCsv(head: string[], rows: (string | number)[][]) {
  return [head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

export const ledgerToCsv = (rows: LedgerRow[]) =>
  toCsv(
    [
      "Period",
      "Order",
      "Due date",
      "Expected (INR)",
      "Received (INR)",
      "Outstanding (INR)",
      "Credit (INR)",
      "Status",
    ],
    rows.map((r) => [
      r.period,
      r.orderId,
      r.dueDate,
      r.expected,
      r.received,
      r.outstanding,
      r.credit,
      r.status,
    ]),
  );

export const paymentsToCsv = (payments: Payment[]) =>
  toCsv(
    ["Payment date", "Order", "Period", "Amount (INR)", "Status", "Reference", "Notes", "Proof file", "Proof SHA-256"],
    [...payments]
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
      .map((p) => [
        p.paymentDate.slice(0, 10),
        p.orderId,
        p.period ?? "",
        p.amount,
        p.status,
        p.reference ?? "",
        p.notes ?? "",
        p.proof?.fileName ?? "",
        p.proof?.sha256 ?? "",
      ]),
  );

export const arrearsToCsv = (rows: ArrearsRow[]) =>
  toCsv(
    [
      "Period",
      "Order",
      "Due date",
      "Paid so far (INR)",
      "Last paid on",
      "Days overdue",
      "Unpaid (INR)",
      "Interest (INR)",
    ],
    rows.map((r) => [
      r.period,
      r.orderId,
      r.dueDate,
      r.paid,
      r.lastPaidOn ?? "",
      r.daysOverdue,
      r.unpaid,
      r.interest === null ? "Rule pending" : r.interest,
    ]),
  );

export function downloadCsv(name: string, csv: string) {
  // BOM so Excel opens UTF-8 correctly.
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
