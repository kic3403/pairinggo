/** 비밀번호 찾기(2026-09-19) — 휴대폰 문자 인증으로 재설정 */
import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail } from "@/lib/legal";
import ForgotForm from "./ForgotForm";

export const metadata: Metadata = { title: "비밀번호 찾기 | 페어링GO", robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      <h1>비밀번호 찾기</h1>
      <p className="lead">가입한 이메일과 인증한 휴대폰 번호를 넣으면 문자로 인증번호를 보내 드려요.</p>
      <ForgotForm contact={contactEmail()} />
      <p className="small" style={{ marginTop: 14 }}><Link href="/login">로그인으로 돌아가기</Link></p>
    </div>
  );
}
