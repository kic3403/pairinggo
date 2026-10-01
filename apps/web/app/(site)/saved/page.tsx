/** 이 기기에 저장한 것(2026-10-01) — 비로그인 하트 목록. 로그인 회원은 마이페이지로 보낸다(계정으로 옮겨져 있다). */
import type { Metadata } from "next";
import GuestSavedList from "./GuestSavedList";

export const metadata: Metadata = { title: "저장한 것 | 페어링GO", robots: { index: false } };

export default function SavedPage() {
  return <div className="wrap"><GuestSavedList /></div>;
}
