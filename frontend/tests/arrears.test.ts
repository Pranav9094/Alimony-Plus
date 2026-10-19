import { describe, expect, it } from "vitest";
import { buildArrears, daysBetween } from "../src/lib/arrears";
import { buildLedger } from "../src/lib/ledger";
import { ledgerToCsv, toCsv } from "../src/lib/export";
import type { Order } from "../src/lib/types";

const order: Order = {
  id: 1,
  proceedingId: 1,
  amount: 10000,
  effectiveDate: "2026-01-01",
  dueDay: 5,
};

describe("arrears", () => {
  it("lists only past-due unpaid periods and counts days", () => {
    const ledger = buildLedger([order], [], "2026-03-10");
    const rows = buildArrears(ledger, "2026-03-10");
    expect(rows.map((r) => r.period)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(rows[2].daysOverdue).toBe(5);
    expect(rows[0].unpaid).toBe(10000);
  });
  it("does not invent interest without an approved rule", () => {
    const rows = buildArrears(buildLedger([order], [], "2026-03-10"), "2026-03-10");
    expect(rows.every((r) => r.interest === null)).toBe(true);
  });
  it("computes interest only when a rule is supplied", () => {
    const rows = buildArrears(buildLedger([order], [], "2026-03-10"), "2026-03-10", {
      annualRatePercent: 10,
    });
    expect(rows[2].interest).toBe(13.7);
  });
  it("daysBetween never goes negative", () => {
    expect(daysBetween("2026-03-10", "2026-03-01")).toBe(0);
  });
});

describe("csv export", () => {
  it("escapes quotes and neutralises formulas", () => {
    expect(toCsv(["a"], [['say "hi"'], ["=1+1"]])).toBe(
      '"a"\r\n"say ""hi"""\r\n"\'=1+1"',
    );
  });
  it("has one line per ledger row plus header", () => {
    const rows = buildLedger([order], [], "2026-03-10");
    expect(ledgerToCsv(rows).split("\r\n")).toHaveLength(rows.length + 1);
  });
});

import { buildReceipt, verifyReceiptText, receiptJson, receiptPdf } from "../src/lib/receipt";
import { buildExhibitPdf } from "../src/lib/exhibit";

describe("receipts", () => {
  const pay = {
    id: 7,
    orderId: 1,
    amount: 6000,
    paymentDate: "2026-02-06",
    status: "RECEIVED" as const,
    period: "2026-02",
    reference: "UTR123",
  };
  it("verifies an untouched receipt and rejects an edited one", async () => {
    const signed = await buildReceipt(pay, "2026-03-10");
    expect((await verifyReceiptText(receiptJson(signed))).ok).toBe(true);
    const tampered = { ...signed, receipt: { ...signed.receipt, amount: 9000 } };
    expect((await verifyReceiptText(JSON.stringify(tampered))).ok).toBe(false);
  });
  it("produces valid-looking PDFs", async () => {
    const signed = await buildReceipt(pay, "2026-03-10");
    const head = new TextDecoder().decode(receiptPdf(signed).slice(0, 8));
    expect(head).toBe("%PDF-1.4");
    const ledger = buildLedger([order], [pay], "2026-03-10");
    const { bytes, fingerprint } = await buildExhibitPdf({
      asOf: "2026-03-10",
      synthetic: true,
      orders: [order],
      ledger,
      arrears: buildArrears(ledger, "2026-03-10", null, [pay]),
      payments: [pay],
    });
    expect(fingerprint).toHaveLength(64);
    expect(new TextDecoder().decode(bytes.slice(-5))).toBe("%%EOF");
  });
});
