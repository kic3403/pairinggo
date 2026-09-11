/** 간편로그인 — 등록된 공급자만 버튼으로 보여 준다. */
import type { Metadata } from "next";
import Link from "next/link";
import { PROVIDER_LABEL, authEnabled, enabledProviders, signIn } from "@/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "로그인 | 페어링GO", robots: { index: false } };

const STYLE: Record<string, { bg: string; fg: string }> = {
  kakao: { bg: "#FEE500", fg: "#191600" },
  naver: { bg: "#03C75A", fg: "#fff" },
  google: { bg: "#fff", fg: "#1F1E1C" },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";   // 오픈 리다이렉트 방지 — 내부 경로만
  const list = enabledProviders();

  return (
    <div className="wrap" style={{ maxWidth: 460 }}>
      <h1>로그인</h1>
      <p className="lead">저장한 전통주와 음식을 어느 기기에서나 볼 수 있습니다.</p>

      {sp.error && <p style={{ color: "var(--food-ink)" }}>로그인에 실패했습니다. 다시 시도해 주세요.</p>}

      {!authEnabled() || !list.length ? (
        <div className="box" style={{ marginTop: 18 }}>
          <b>아직 로그인을 켜지 않았습니다.</b>
          <p className="small muted" style={{ marginTop: 6 }}>
            카카오·네이버·구글 개발자 콘솔에서 앱을 등록하고 <code>apps/web/.env.local</code>에 키를 넣으면 켜집니다.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {list.map((p) => (
            <form
              key={p}
              action={async () => {
                "use server";
                await signIn(p, { redirectTo: next });
              }}
            >
              <button type="submit" className="btn" style={{ width: "100%", background: STYLE[p].bg, color: STYLE[p].fg, borderColor: p === "google" ? "var(--line)" : STYLE[p].bg }}>
                {PROVIDER_LABEL[p]}로 시작하기
              </button>
            </form>
          ))}
        </div>
      )}

      <p className="small muted" style={{ marginTop: 22 }}>
        로그인하면 공급자가 주는 닉네임과 이메일을 받아 저장합니다. 페어링GO는 주류를 직접 판매하지 않으며, 만 19세 이상만 주류를 구매할 수 있습니다.
      </p>
      <p className="small" style={{ marginTop: 10 }}><Link href="/">홈으로</Link></p>
    </div>
  );
}
