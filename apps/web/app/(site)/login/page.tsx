/** 로그인 — 이메일·비밀번호 + 간편로그인(등록된 공급자만). */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { PROVIDER_LABEL, enabledProviders, signIn } from "@/auth";
import AuthAttempt from "../_components/AuthAttempt";
import PasswordField from "../_components/PasswordField";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "로그인 | 페어링GO", robots: { index: false } };

const STYLE: Record<string, { bg: string; fg: string; border?: string }> = {
  kakao: { bg: "#FEE500", fg: "#191600" },
  naver: { bg: "#03C75A", fg: "#fff" },
  google: { bg: "#fff", fg: "#1F1E1C", border: "var(--line)" },
};

/** 내부 경로만 허용 — 오픈 리다이렉트 방지 */
const safeNext = (v?: string) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/my");

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const social = enabledProviders();

  async function emailLogin(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const to = safeNext(String(formData.get("next") ?? ""));
    try {
      await signIn("email", { email, password, redirectTo: to });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/login?error=cred&next=${encodeURIComponent(to)}`);
      throw e;   // NEXT_REDIRECT 등은 그대로 통과시켜야 이동한다
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      <AuthAttempt />
      <h1>로그인</h1>
      <p className="lead">저장한 전통주·음식·음식점을 어느 기기에서나 볼 수 있습니다.</p>

      {sp.error && <p className="form-error">{sp.error === "cred" ? "이메일 또는 비밀번호가 맞지 않습니다." : "로그인에 실패했습니다. 다시 시도해 주세요."}</p>}

      <form action={emailLogin} style={{ marginTop: 18 }}>
        <input type="hidden" name="next" value={next} />
        <label className="field"><span>이메일</span><input name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></label>
        <PasswordField name="password" label="비밀번호" autoComplete="current-password" minLength={8} />
        <button type="submit" className="btn p" style={{ width: "100%" }}>로그인</button>
      </form>

      <p className="small muted" style={{ marginTop: 12 }}>
        계정이 없으신가요? <Link href={`/signup?next=${encodeURIComponent(next)}`}>회원가입</Link>
      </p>

      {!!social.length && (
        <>
          <div className="divider">간편로그인</div>
          <div style={{ display: "grid", gap: 10 }}>
            {social.map((p) => (
              <form key={p} action={async () => { "use server"; await signIn(p, { redirectTo: next }); }}>
                <button type="submit" className="btn" style={{ width: "100%", background: STYLE[p].bg, color: STYLE[p].fg, borderColor: STYLE[p].border ?? STYLE[p].bg }}>
                  {PROVIDER_LABEL[p]}로 계속하기
                </button>
              </form>
            ))}
          </div>
        </>
      )}

      <p className="small muted" style={{ marginTop: 22 }}>
        페어링GO는 주류를 직접 판매하지 않으며, 만 19세 이상만 주류를 구매할 수 있습니다.
      </p>
      <p className="small" style={{ marginTop: 10 }}><Link href="/">홈으로</Link></p>
    </div>
  );
}
