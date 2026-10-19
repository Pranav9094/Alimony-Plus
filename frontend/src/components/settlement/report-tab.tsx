"use client";

import { useState } from "react";
import {
  verifyReport,
  type SettlementReport,
  type VerifyResult,
} from "@/lib/settlement/fingerprint";
import { downloadSettlementPdf } from "./report-pdf";

interface ReportTabProps {
  report: SettlementReport | null;
}

export default function ReportTab({ report }: ReportTabProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [verification, setVerification] = useState<VerifyResult | null>(null);
  const [importedJson, setImportedJson] = useState("");

  async function downloadPdf() {
    if (!report) return;

    setBusy(true);
    setStatus("");

    try {
      await downloadSettlementPdf(report);
      setStatus("PDF generated successfully.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not generate the PDF.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyFingerprint() {
    if (!report) return;

    try {
      await navigator.clipboard.writeText(report.sha256);
      setStatus("SHA-256 fingerprint copied.");
    } catch {
      setStatus("Clipboard access is unavailable in this browser.");
    }
  }

  async function verifyCurrentReport() {
    if (!report) return;

    setBusy(true);

    try {
      setVerification(await verifyReport(report));
    } catch (error) {
      setVerification({
        ok: false,
        hashMatches: false,
        calculationMatches: false,
        reason: error instanceof Error ? error.message : "Verification failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function verifyImportedReport() {
    setBusy(true);

    try {
      const parsed: unknown = JSON.parse(importedJson);
      setVerification(await verifyReport(parsed));
    } catch (error) {
      setVerification({
        ok: false,
        hashMatches: false,
        calculationMatches: false,
        reason:
          error instanceof Error
            ? error.message
            : "Invalid JSON or verification failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!report) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-900">Settlement report</h2>
        <p className="mt-2 text-sm text-slate-600">
          Complete the financial inputs and create a settlement report before
          exporting or verifying it.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Settlement report</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review the report, export a PDF and verify its integrity.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Report identity</h3>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Report ID</dt>
            <dd className="mt-1 break-all font-mono text-slate-900">
              {report.reportId}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">Created at</dt>
            <dd className="mt-1 text-slate-900">{report.createdAt}</dd>
          </div>

          <div>
            <dt className="text-slate-500">SHA-256 fingerprint</dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-800">
              {report.sha256}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={busy}
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? "Processing..." : "Download PDF"}
          </button>

          <button
            type="button"
            onClick={copyFingerprint}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Copy fingerprint
          </button>

          <button
            type="button"
            onClick={verifyCurrentReport}
            disabled={busy}
            className="rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
          >
            Verify current report
          </button>
        </div>

        {status && (
          <p role="status" className="mt-3 text-sm text-slate-600">
            {status}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">
          Verify an exported report
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Paste the complete JSON report below to check its fingerprint and
          recalculate its stored results.
        </p>

        <label
          htmlFor="imported-report-json"
          className="mt-4 block text-sm font-medium text-slate-700"
        >
          Report JSON
        </label>

        <textarea
          id="imported-report-json"
          value={importedJson}
          onChange={(event) => setImportedJson(event.target.value)}
          rows={7}
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          placeholder="Paste a previously exported Settlement Studio JSON report..."
        />

        <button
          type="button"
          onClick={verifyImportedReport}
          disabled={busy || !importedJson.trim()}
          className="mt-3 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Verify pasted report
        </button>
      </section>

      {verification && (
        <section
          aria-live="polite"
          className={`rounded-xl border p-5 ${
            verification.ok
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <h3 className="font-semibold text-slate-900">
            {verification.ok ? "Report verified" : "Verification failed"}
          </h3>

          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="inline text-slate-600">Fingerprint matches: </dt>
              <dd className="inline font-semibold">
                {verification.hashMatches ? "Yes" : "No"}
              </dd>
            </div>

            <div>
              <dt className="inline text-slate-600">Calculation matches: </dt>
              <dd className="inline font-semibold">
                {verification.calculationMatches ? "Yes" : "No"}
              </dd>
            </div>
          </dl>

          {verification.reason && (
            <p className="mt-3 text-sm text-amber-900">{verification.reason}</p>
          )}
        </section>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Illustrative financial planning only, not legal advice. A SHA-256
        fingerprint is tamper-evident metadata, not a digital signature.
      </p>
    </div>
  );
}
