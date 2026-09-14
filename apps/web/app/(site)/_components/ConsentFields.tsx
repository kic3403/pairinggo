"use client";
/**
 * 가입 동의 체크 — 모두 동의 + 필수 항목(이용약관·개인정보 수집·이용·만 19세 이상). 항목 목록·검증은 packages/shared/src/consent.ts.
 * 본문은 서버에서 details로 넘겨받아 접었다 펼친다(새 탭으로 열면 첫 화면 로그아웃 규칙에 걸려 로그인이 풀린다).
 * 체크박스는 required라 브라우저가 먼저 막고, 서버 액션이 consentProblem으로 한 번 더 확인한다.
 */
import { useState, type ReactNode } from "react";
import { CONSENT_ITEMS, consentField, type ConsentKey } from "@pairinggo/shared";

export default function ConsentFields({ details }: { details: Partial<Record<ConsentKey, ReactNode>> }) {
  const [on, setOn] = useState<Record<string, boolean>>({});
  const all = CONSENT_ITEMS.every((i) => on[i.key]);
  const setAll = (v: boolean) => setOn(Object.fromEntries(CONSENT_ITEMS.map((i) => [i.key, v])));

  return (
    <fieldset className="consent">
      <legend>약관 동의</legend>
      <label className="consent-all">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        <b>모두 동의합니다</b>
      </label>
      <ul>
        {CONSENT_ITEMS.map((i) => (
          <li key={i.key}>
            <label className="consent-row">
              <input type="checkbox" name={consentField(i.key)} checked={!!on[i.key]} onChange={(e) => setOn((s) => ({ ...s, [i.key]: e.target.checked }))} required={i.required} />
              <span><em className="req">[필수]</em> {i.label}</span>
            </label>
            {details[i.key] && (
              <details className="consent-more">
                <summary>내용 보기</summary>
                <div className="consent-box">{details[i.key]}</div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
