/** 회원가입 — 이메일·비밀번호. 가입하면 바로 로그인된다. */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { PROVIDER_LABEL, enabledProviders, signIn } from "@/auth";
import { signUpWithEmail } from "@/lib/account";

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
    const name = String(formData.get("name") ?? "").trim();
    const to = safeNext(String(formData.get("next") ?? ""));

    const r = await signUpWithEmail(email, password, name);
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
      <h1>회원가입</h1>
      <p className="lead">저장한 전통주·음식·음식점이 기기가 바뀌어도 남습니다.</p>

      {sp.error && <p className="form-error">{sp.error}</p>}

      <form action={create} style={{ marginTop: 18 }}>
        <input type="hidden" name="next" value={next} />
        <label className="field"><span>이메일</span><input name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></label>
        <label className="field"><span>비밀번호 <span className="muted" style={{ fontWeight: 400 }}>8자 이상</span></span><input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
        <label className="field"><span>닉네임 <span className="muted" style={{ fontWeight: 400 }}>선택</span></span><input name="name" type="text" maxLength={20} placeholder="비우면 이메일 앞부분을 씁니다" /></label>
        <button type="submit" className="btn p" style={{ width: "100%" }}>가입하고 시작하기</button>
      </form>

      <p className="small muted" style={{ marginTop: 12 }}>
        이미 계정이 있으신가요? <Link href={`/login?next=${encodeURIComponent(next)}`}>로그인</Link>
      </p>

      {!!social.length && (
        <>
          <div className="divider">간편가입</div>
          <div style={{ display: "grid", gap: 10 }}>
            {social.map((p) => (
              <form key={p} action={async () => { "use server"; await signIn(p, { redirectTo: next }); }}>
                <button type="submit" className="btn" style={{ width: "100%" }}>{PROVIDER_LABEL[p]}로 계속하기</button>
              </form>
            ))}
          </div>
        </>
      )}

      <p className="small muted" style={{ marginTop: 22 }}>
        가입하면 이메일과 닉네임을 저장합니다. 페어링GO는 주류를 직접 판매하지 않으며, 만 19세 이상만 주류를 구매할 수 있습니다.
      </p>
    </div>
  );
}
