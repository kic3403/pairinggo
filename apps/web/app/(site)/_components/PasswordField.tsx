"use client";
/**
 * 비밀번호 입력 — 눈 버튼으로 보기/숨기기. 자바스크립트가 꺼져 있어도 일반 비밀번호 칸으로 동작한다.
 * `confirmOf`를 주면 "비밀번호 확인" 칸이 되어 원본 칸과 다르면 브라우저 제출을 막고 안내를 띄운다.
 */
import { useEffect, useId, useState } from "react";

type Props = {
  name: string;
  label: string;
  hint?: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  /** 확인 칸일 때 원본 칸의 name */
  confirmOf?: string;
};

export default function PasswordField({ name, label, hint, autoComplete, minLength, confirmOf }: Props) {
  const [show, setShow] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [value, setValue] = useState("");
  const msgId = useId();

  // 확인 칸: 원본 칸의 값이 바뀌어도 다시 비교한다(원본을 나중에 고치는 경우)
  useEffect(() => {
    if (!confirmOf) return;
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    const src = document.querySelector<HTMLInputElement>(`input[name="${confirmOf}"]`);
    if (!input || !src) return;
    const check = () => {
      const bad = input.value.length > 0 && input.value !== src.value;
      setMismatch(bad);
      input.setCustomValidity(bad ? "비밀번호가 서로 다릅니다." : "");
    };
    check();
    src.addEventListener("input", check);
    return () => src.removeEventListener("input", check);
  }, [confirmOf, name, value]);

  return (
    <label className="field">
      <span>{label}{hint && <span className="muted" style={{ fontWeight: 400 }}> {hint}</span>}</span>
      <span className="pw">
        <input
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={mismatch || undefined}
          aria-describedby={confirmOf ? msgId : undefined}
          spellCheck={false}
        />
        <button
          type="button"
          className="eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
          aria-pressed={show}
          title={show ? "숨기기" : "보기"}
        >
          {show ? (
            /* 눈에 사선 — 지금 보이는 중 */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 12s3.5-6 10-6c1.6 0 3 .3 4.3.9M22 12s-3.5 6-10 6c-1.6 0-3-.3-4.3-.9" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              <path d="M3 3l18 18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
      {confirmOf && (
        <span id={msgId} className={`field-msg${mismatch ? " bad" : ""}`} aria-live="polite">
          {mismatch ? "비밀번호가 서로 다릅니다." : value && !mismatch ? "비밀번호가 일치합니다." : ""}
        </span>
      )}
    </label>
  );
}
