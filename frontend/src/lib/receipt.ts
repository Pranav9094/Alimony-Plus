import type { Payment } from "./types";
import { buildPdf, wrap, type PdfLine } from "./pdf";

export async function sha256Hex(data: ArrayBuffer | string) {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type Receipt = {
  schema: "alimony-plus-receipt/1";
  receiptNo: string;
  issuedOn: string;
  orderId: number;
  period: string | null;
  amount: number;
  paymentDate: string;
  status: Payment["status"];
  reference: string;
  notes: string;
  proofFileName: string | null;
  proofSha256: string | null;
};
export type SignedReceipt = { receipt: Receipt; fingerprint: string };

// Stable text so the same receipt always hashes the same way.
export function canonical(receipt: Receipt) {
  return JSON.stringify(
    Object.fromEntries(Object.entries(receipt).sort(([a], [b]) => a.localeCompare(b))),
  );
}

export async function buildReceipt(
  payment: Payment,
  issuedOn: string,
): Promise<SignedReceipt> {
  const receipt: Receipt = {
    schema: "alimony-plus-receipt/1",
    receiptNo: `AP-${payment.orderId}-${payment.id}`,
    issuedOn,
    orderId: payment.orderId,
    period: payment.period ?? null,
    amount: Number(payment.amount),
    paymentDate: payment.paymentDate.slice(0, 10),
    status: payment.status,
    reference: payment.reference ?? "",
    notes: payment.notes ?? "",
    proofFileName: payment.proof?.fileName ?? null,
    proofSha256: payment.proof?.sha256 ?? null,
  };
  return { receipt, fingerprint: await sha256Hex(canonical(receipt)) };
}

export async function verifyReceiptText(text: string) {
  try {
    const parsed = JSON.parse(text) as Partial<SignedReceipt>;
    if (!parsed.receipt || !parsed.fingerprint)
      return { ok: false, message: "This is not an Alimony+ receipt file." };
    const again = await sha256Hex(canonical(parsed.receipt));
    return again === parsed.fingerprint
      ? {
          ok: true,
          message: `Verified: receipt ${parsed.receipt.receiptNo} is unchanged since it was generated.`,
        }
      : {
          ok: false,
          message:
            "Not verified: the receipt contents do not match its fingerprint. It may have been edited.",
        };
  } catch {
    return { ok: false, message: "Could not read this file as a receipt." };
  }
}

export async function verifyProofFile(file: File, expected: string) {
  return (await sha256Hex(await file.arrayBuffer())) === expected;
}

export function receiptJson(signed: SignedReceipt) {
  return JSON.stringify(signed, null, 2);
}

export function receiptPdf(signed: SignedReceipt) {
  const r = signed.receipt;
  const rs = (n: number) => `Rs. ${n.toFixed(2)}`;
  const lines: PdfLine[] = [
    { text: "PAYMENT RECEIPT", bold: true, size: 16 },
    { text: `Receipt no: ${r.receiptNo}`, bold: true },
    { text: `Generated on: ${r.issuedOn}` },
    { text: "" },
    { text: `Court order:   #${r.orderId}` },
    { text: `Period:        ${r.period ?? "Not recorded"}` },
    { text: `Amount:        ${rs(r.amount)}` },
    { text: `Received on:   ${r.paymentDate}` },
    { text: `Status:        ${r.status}` },
    ...wrap(`Reference:     ${r.reference || "Not recorded"}`).map((text) => ({ text })),
    ...wrap(`Notes:         ${r.notes || "-"}`).map((text) => ({ text })),
    { text: "" },
    { text: "Payment proof", bold: true },
    ...wrap(`File: ${r.proofFileName ?? "No proof attached"}`).map((text) => ({ text })),
    ...wrap(`SHA-256: ${r.proofSha256 ?? "-"}`, 80).map((text) => ({ text })),
    { text: "" },
    { text: "Receipt fingerprint (SHA-256)", bold: true },
    ...wrap(signed.fingerprint, 80).map((text) => ({ text })),
    { text: "" },
    ...wrap(
      "How to verify: keep the matching .json receipt file and use 'Verify receipt' in Alimony+. It recomputes the fingerprint and detects any later change. This is an integrity check, not a court certification or a legally recognised digital signature.",
    ).map((text) => ({ text })),
  ];
  return buildPdf(lines, r.receiptNo);
}
