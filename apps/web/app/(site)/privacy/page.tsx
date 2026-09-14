/** 개인정보처리방침 — 본문은 _components/legal/PrivacyPolicy.tsx */
import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import PrivacyPolicy from "../_components/legal/PrivacyPolicy";

export const metadata: Metadata = { title: "개인정보처리방침 | 페어링GO", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <div className="wrap legal-page">
      <h1>개인정보처리방침</h1>
      <p className="small muted">시행일 {LEGAL.effective}</p>
      <PrivacyPolicy />
    </div>
  );
}
