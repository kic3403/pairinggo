/** 성별·생년월일·사는 곳 입력 — 회원가입과 프로필 화면이 같이 쓴다(서버 컴포넌트, 일반 폼 필드). */
import { GENDER_OPTIONS, SIDO_OPTIONS } from "@pairinggo/shared";

export default function ProfileFields({ gender, birthDate, sido }: { gender?: string | null; birthDate?: string | null; sido?: string | null }) {
  const max = new Date(Date.now() - 19 * 365.25 * 86400000).toISOString().slice(0, 10);   // 만 19세 이상만
  return (
    <>
      <fieldset className="field seg">
        <legend>성별</legend>
        <div className="seg-row">
          {GENDER_OPTIONS.map((g) => (
            <label key={g.value} className="seg-opt">
              <input type="radio" name="gender" value={g.value} defaultChecked={gender === g.value} required />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field"><span>생년월일 <span className="muted" style={{ fontWeight: 400 }}>만 19세 이상</span></span><input name="birthDate" type="date" defaultValue={birthDate ?? ""} max={max} min="1900-01-01" required /></label>
      <label className="field"><span>사는 곳 <span className="muted" style={{ fontWeight: 400 }}>시·도</span></span>
        <select name="sido" defaultValue={sido ?? ""} required>
          <option value="" disabled>골라 주세요</option>
          {SIDO_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
    </>
  );
}
