import type { Metadata } from "next";
import { Wizard } from "@/components/filing/wizard";
import "./filing.css";

export const metadata: Metadata = {
  title: "File a new case · Alimony Plus",
};

export default function FilingPage() {
  return (
    <main className="filing">
      <Wizard />
    </main>
  );
}