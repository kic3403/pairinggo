"use client";
/**
 * 로그인·가입 화면에서 폼을 보내면 "방금 로그인 시도함" 표시를 남긴다.
 * 이 표시가 있으면 돌아온 첫 화면에서 세션을 지우지 않는다(SavedProvider) — 카카오·네이버 로그인은 외부를 거쳐 돌아오기 때문.
 * 표시는 다음 화면에서 한 번 쓰고 지운다.
 */
import { useEffect } from "react";

export const AUTH_PENDING_KEY = "pg_auth";

export default function AuthAttempt() {
  useEffect(() => {
    const mark = () => { try { window.sessionStorage.setItem(AUTH_PENDING_KEY, "1"); } catch { /* 사설 모드 */ } };
    document.addEventListener("submit", mark, true);
    return () => document.removeEventListener("submit", mark, true);
  }, []);
  return null;
}
