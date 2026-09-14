"use client";
/**
 * 생년월일 직접 입력 — 8자리 숫자만(19871024). 숫자가 아닌 글자는 입력하는 즉시 지우고 8자리에서 자른다.
 * 제어 컴포넌트(useState)로 거르면 걸러진 값이 이전 값과 같을 때 화면 값이 안 바뀌어 "1987a"가 남고,
 * maxLength에 먼저 걸려 뒤 숫자가 잘렸다(실측) → 입력 이벤트에서 칸의 값을 직접 고친다.
 * 서버는 packages/shared/src/profile.ts birthDigitsToDate로 YYYY-MM-DD 변환·검증(없는 날짜·만 19세 미만 거절)을 다시 한다.
 */
export default function BirthDateInput({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <label className="field">
      <span>생년월일 <span className="muted" style={{ fontWeight: 400 }}>8자리 숫자 · 만 19세 이상</span></span>
      <input
        name="birthDate"
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="예: 19871024"
        pattern="[0-9]{8}"
        title="생년월일 8자리 숫자(예: 19871024)"
        required
        defaultValue={defaultValue}
        onInput={(e) => {
          const el = e.currentTarget;
          const clean = el.value.replace(/\D/g, "").slice(0, 8);
          if (el.value !== clean) el.value = clean;
        }}
      />
    </label>
  );
}
