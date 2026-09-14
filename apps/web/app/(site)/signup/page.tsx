/** 회원가입 — 이메일·비밀번호. 가입하면 바로 로그인된다. */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { enabledProviders, signIn } from "@/auth";
import SocialButton from "../_components/SocialButton";
import { signUpWithEmail } from "@/lib/account";
import AuthAttempt from "../_components/AuthAttempt";
import PasswordField from "../_components/PasswordField";
import NicknameField from "../_components/NicknameField";
import ProfileFields from "../_components/ProfileFields";
import { birthDigitsToDate, consentFromForm, consentProblem, type Gender, type Sido } from "@pairinggo/shared";
import ConsentFields from "../_components/ConsentFields";
import Terms from "../_components/legal/Terms";
import { PrivacyConsentSummary } from "../_components/legal/PrivacyPolicy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "회원가입 | 페어링GO", robots: { index: false } };

const safeNext = (v?: string) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/my");

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const social = enabledProviders();

  async function create(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("password2") ?? "");
    const name = String(formData.get("nickname") ?? "");
    const to = safeNext(String(formData.get("next") ?? ""));

    // 브라우저 검사와 별개로 서버에서도 한 번 더 — 자바스크립트가 꺼진 경우
    if (password !== confirm) redirect(`/signup?error=${encodeURIComponent("비밀번호가 서로 다릅니다. 다시 입력해 주세요.")}&next=${encodeURIComponent(to)}`);

    const noConsent = consentProblem(consentFromForm((k) => formData.get(k)));
    if (noConsent) redirect(`/signup?error=${encodeURIComponent(noConsent)}&next=${encodeURIComponent(to)}`);

    // 생년월일은 8자리(19871024) → YYYY-MM-DD. 틀리면 빈 값이 되어 profileProblem이 안내한다
    const profile = { gender: String(formData.get("gender") ?? "") as Gender, birthDate: birthDigitsToDate(String(formData.get("birthDate") ?? "")) ?? "", sido: String(formData.get("sido") ?? "") as Sido };
    const r = await signUpWithEmail(email, password, name, profile, String(formData.get("referrer") ?? ""));
    if (!r.ok) redirect(`/signup?error=${encodeURIComponent(r.error)}&next=${encodeURIComponent(to)}`);
    try {
      await signIn("email", { email, password, redirectTo: to });
    } catch (e) {
      // 가입은 됐는데 자동 로그인이 안 된 경우 — 로그인 화면으로 보낸다
      if (e instanceof AuthError) redirect(`/login?next=${encodeURIComponent(to)}`);
      throw e;
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      <AuthAttempt />
      <h1>회원가입</h1>
      <p className="lead">저장한 전통주·음식·음식점이 기기가 바뀌어도 남습니다.</p>

      {sp.error && <p className="form-error">{sp.error}</p>}

      <form action={create} style={{ marginTop: 18 }}>
        <input type="hidden" name="next" value={next} />
        <label className="field"><span>이메일</span><input name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></label>
        <PasswordField name="password" label="비밀번호" hint="8자 이상" autoComplete="new-password" minLength={8} />
        <PasswordField name="password2" label="비밀번호 확인" autoComplete="new-password" minLength={8} confirmOf="password" />
        <NicknameField />
        <ProfileFields />
        <label className="field"><span>추천인 닉네임 <span className="muted" style={{ fontWeight: 400 }}>선택 · 소개해 준 회원의 닉네임</span></span><input name="referrer" type="text" maxLength={24} placeholder="예: 막걸리러버" autoComplete="off" /></label>
        <ConsentFields details={{ terms: <Terms />, privacy: <PrivacyConsentSummary /> }} />
        <button type="submit" className="btn p" style={{ width: "100%" }}>가입하고 시작하기</button>
      </form>

      <p className="small muted" style={{ marginTop: 12 }}>
        이미 계정이 있으신가요? <Link href={`/login?next=${encodeURIComponent(next)}`}>로그인</Link>
      </p>

      {!!social.length && (
        <>
          <div className="divider">간편가입</div>
          <p className="small muted" style={{ margin: "0 0 10px" }}>계정을 연결한 뒤 약관 동의와 프로필 입력 화면으로 이어집니다.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {social.map((p) => (
              <form key={p} action={async () => { "use server"; await signIn(p, { redirectTo: next }); }}>
                <SocialButton provider={p} />
              </form>
            ))}
          </div>
        </>
      )}

      <p className="small muted" style={{ marginTop: 22 }}>
        성별·생년월일·사는 시·도는 성별·연령대·지역별 페어링 통계에만 쓰고 개인을 알아보는 데 쓰지 않습니다. 주류 정보 서비스라 만 19세 이상만 가입할 수 있습니다. 페어링GO는 주류를 직접 판매하지 않습니다.
        {" "}<Link href="/terms">이용약관</Link> · <Link href="/privacy"><b>개인정보처리방침</b></Link>
      </p>
    </div>
  );
}
