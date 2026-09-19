/**
 * 같은 사람 중복 가입 막기(2026-09-19 사용자 결정) — 페어링GO·파트너 앱 모두.
 * 이메일 가입·카카오·네이버·구글 중 하나로 가입한 사람이 다른 방법으로 새로 가입하려 하면 "이미 가입된 계정"으로 막고
 * 원래 가입한 방법을 알려 준다(자동으로 합치지 않는다 — 확인 안 된 이메일로 남의 계정에 붙는 사고를 막기 위해).
 *
 * 같은 사람으로 보는 기준
 *  · 이메일이 같다(대소문자·앞뒤 공백 무시) — 공급자가 인증했다고 한 이메일만 넘긴다(카카오 is_email_verified·구글 email_verified)
 *  · 휴대폰 번호가 같고, 양쪽에 이름이 다 있으면 이름도 같다(공백 무시)
 *    — 파트너 앱은 가입 때 이름·번호를 받아 "이름 + 번호"로, 페어링GO는 실명을 받지 않아 문자 인증한 번호만으로 본다.
 */
import { normalizeMobile } from "./reservation/phone";

export type LoginMethod = "email" | "kakao" | "naver" | "google";
export const LOGIN_METHOD_LABEL: Record<LoginMethod, string> = { email: "이메일", kakao: "카카오", naver: "네이버", google: "구글" };
export const LOGIN_METHODS: LoginMethod[] = ["email", "kakao", "naver", "google"];

export type Identity = { email?: string | null; phone?: string | null; name?: string | null };

const normEmail = (v?: string | null) => String(v ?? "").trim().toLowerCase() || null;
const normName = (v?: string | null) => String(v ?? "").replace(/\s+/g, "").toLowerCase() || null;
const normPhone = (v?: string | null) => (v ? normalizeMobile(v) : null);

/** 두 신원이 같은 사람인지 — 이유(email·phone) 또는 null */
export function sameIdentity(a: Identity, b: Identity): "email" | "phone" | null {
  const ea = normEmail(a.email), eb = normEmail(b.email);
  if (ea && eb && ea === eb) return "email";
  const pa = normPhone(a.phone), pb = normPhone(b.phone);
  if (pa && pb && pa === pb) {
    const na = normName(a.name), nb = normName(b.name);
    if (!na || !nb || na === nb) return "phone";
  }
  return null;
}

/** 방법 목록 정리 — 순서 고정(이메일·카카오·네이버·구글), 중복·모르는 값 제거. 주소(?via=)에서 읽을 때도 쓴다 */
export function cleanMethods(v: readonly string[] | string | null | undefined): LoginMethod[] {
  const arr = typeof v === "string" ? v.split(",") : (v ?? []);
  const set = new Set(arr.map((s) => String(s).trim()));
  return LOGIN_METHODS.filter((m) => set.has(m));
}

/**
 * 안내 문구 — "이미 가입된 계정이 있어요. 이메일로 가입하셨어요 — 그 방법으로 로그인해 주세요." (라벨이 모두 모음·ㄹ로 끝나 "로")
 * partner면 로그인 뒤 설정에서 간편로그인을 이어 쓸 수 있다고 덧붙인다.
 */
export function duplicateMessage(methods: readonly string[] | string | null | undefined, app: "web" | "partner" = "web"): string {
  const ms = cleanMethods(methods);
  const via = ms.length ? `${ms.map((m) => LOGIN_METHOD_LABEL[m]).join("·")}로 가입하셨어요 — 그 방법으로 로그인해 주세요.` : "원래 가입한 방법으로 로그인해 주세요.";
  const tail = app === "partner" ? " 로그인한 뒤 설정 → 로그인 방법에서 카카오·네이버를 연결할 수 있어요." : "";
  return `이미 가입된 계정이 있어요. ${via}${tail}`;
}
