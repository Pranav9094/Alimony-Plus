import type { LedgerRow, Payment } from "./types";

/**
 * INTEREST RULE: NOT YET APPROVED.
 * Ask the mentor for the project's approved rule (rate, simple vs compound,
 * start date) and set it here. While this is null the table shows
 * "Rule pending" instead of inventing a number.
 */
export type InterestRule = { annualRatePercent: number };
export const APPROVED_INTEREST_RULE: InterestRule | null = null;

export type ArrearsRow = {
  orderId: number;
  period: string;
  dueDate: string;
  unpaid: number;
  paid: number;
  lastPaidOn: string | null;
  daysOverdue: number;
  interest: number | null;
};

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// Placeholder shape (simple interest) so the UI is ready; replace the body
// when the approved rule arrives.
export function interestFor(
  unpaid: number,
  days: number,
  rule: InterestRule | null,
) {
  if (!rule) return null;
  return round((unpaid * rule.annualRatePercent * days) / 100 / 365);
}

export function buildArrears(
  ledger: LedgerRow[],
  asOf: string,
  rule: InterestRule | null = APPROVED_INTEREST_RULE,
  payments: Payment[] = [],
): ArrearsRow[] {
  return ledger
    .filter((r) => r.outstanding > 0 && r.dueDate < asOf)
    .map((r) => {
      const daysOverdue = daysBetween(r.dueDate, asOf);
      const made = payments.filter(
        (p) =>
          p.orderId === r.orderId &&
          p.period === r.period &&
          p.status === "RECEIVED" &&
          p.paymentDate.slice(0, 10) <= asOf,
      );
      return {
        paid: r.received,
        lastPaidOn: made.length
          ? made.map((p) => p.paymentDate.slice(0, 10)).sort().at(-1)!
          : null,
        orderId: r.orderId,
        period: r.period,
        dueDate: r.dueDate,
        unpaid: r.outstanding,
        daysOverdue,
        interest: interestFor(r.outstanding, daysOverdue, rule),
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
