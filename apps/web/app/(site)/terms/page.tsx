/** 이용약관 — 본문은 _components/legal/Terms.tsx */
import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import Terms from "../_components/legal/Terms";

export const metadata: Metadata = { title: "이용약관 | 페어링GO", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <div className="wrap legal-page">
      <h1>이용약관</h1>
      <p className="small muted">시행일 {LEGAL.effective}</p>
      <Terms />
    </div>
  );
}
