"use client";
import { useRef, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import type { Payment } from "@/lib/types";
import {
  buildReceipt,
  receiptJson,
  receiptPdf,
  verifyProofFile,
  verifyReceiptText,
} from "@/lib/receipt";
import { downloadPdf } from "@/lib/pdf";

function saveText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReceiptActions({
  payment,
  asOf,
}: {
  payment: Payment;
  asOf: string;
}) {
  const proofInput = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const no = `AP-${payment.orderId}-${payment.id}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="button secondary compact"
        onClick={async () =>
          downloadPdf(`receipt-${no}.pdf`, receiptPdf(await buildReceipt(payment, asOf)))
        }
      >
        <Download size={14} /> PDF
      </button>
      <button
        className="button secondary compact"
        onClick={async () =>
          saveText(
            `receipt-${no}.json`,
            receiptJson(await buildReceipt(payment, asOf)),
            "application/json",
          )
        }
      >
        <ShieldCheck size={14} /> Verifiable file
      </button>
      {payment.proofFile && payment.proof && (
        <>
          <button
            className="button secondary compact"
            onClick={() => {
              const url = URL.createObjectURL(payment.proofFile!);
              const a = document.createElement("a");
              a.href = url;
              a.download = payment.proof!.fileName;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <Download size={14} /> Proof
          </button>
          <input
            ref={proofInput}
            type="file"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setMsg(
                (await verifyProofFile(f, payment.proof!.sha256))
                  ? "Proof file matches the recorded fingerprint."
                  : "This file does NOT match the recorded proof.",
              );
            }}
          />
          <button
            className="button secondary compact"
            onClick={() => proofInput.current?.click()}
          >
            Check proof file
          </button>
        </>
      )}
      {msg && <small role="status">{msg}</small>}
    </div>
  );
}

export function VerifyReceiptButton() {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) setResult(await verifyReceiptText(await f.text()));
        }}
      />
      <button
        className="button secondary"
        onClick={() => input.current?.click()}
      >
        <ShieldCheck size={16} /> Verify receipt
      </button>
      {result && (
        <small role="status" className={result.ok ? "" : "text-amber"}>
          {result.message}
        </small>
      )}
    </div>
  );
}
