/** 닉네임 입력 — 회원가입·가입 마무리·프로필 화면이 같이 쓴다. 규칙(2~12자, 링크·이메일·운영자 사칭 금지)은 shared profile.ts nicknameProblem, 중복은 서버에서 확인 */
import { NICKNAME_MAX, NICKNAME_MIN } from "@pairinggo/shared";

export default function NicknameField({ defaultValue, missing }: { defaultValue?: string | null; missing?: boolean }) {
  return (
    <label className="field">
      <span>닉네임 <span className="muted" style={{ fontWeight: 400 }}>{NICKNAME_MIN}~{NICKNAME_MAX}자 · 회원 추천 글에 보여요</span></span>
      <input name="nickname" type="text" autoComplete="nickname" required minLength={NICKNAME_MIN} maxLength={24} defaultValue={defaultValue ?? ""} placeholder="예: 막걸리러버" aria-invalid={missing || undefined} />
      {missing && <em className="small form-hint">닉네임이 없거나 쓸 수 없는 이름이에요. 새로 정해 주세요.</em>}
    </label>
  );
}
