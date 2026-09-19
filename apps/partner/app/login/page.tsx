import Link from "next/link";
import { redirect } from "next/navigation";
import { duplicateMessage } from "@pairinggo/shared";
import { Bar } from "../_bar";
import { SocialButtons } from "../SocialButtons";
import { enabledProviders } from "@/lib/oauth";
import { currentPartner } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "로그인" };
export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  oauth_off: "간편로그인을 아직 쓸 수 없어요 — 이메일로 로그인해 주세요",
  oauth_busy: "잠시 뒤 다시 시도해 주세요",
  oauth_state: "로그인 시간이 지났거나 다른 창에서 시작됐어요 — 다시 눌러 주세요",
  oauth_cancel: "간편로그인을 취소했어요",
  oauth_fail: "간편로그인을 확인하지 못했어요 — 잠시 뒤 다시 시도하거나 이메일로 로그인해 주세요",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; via?: string }> }) {
  if (await currentPartner()) redirect("/");
  const sp = await searchParams;
  const err = sp.error === "dup" ? duplicateMessage(sp.via, "partner") : ERR[sp.error ?? ""];
  return (
    <>
      <Bar />
      <main>
        <div className="auth">
          <h1>파트너 로그인</h1>
          <p className="lead">페어링GO로 들어온 예약을 확인하고 매장 정보를 관리해요.</p>
          {err ? <p className="err" role="alert" style={{ marginBottom: 12 }}>{err}</p> : null}
          <LoginForm />
          <SocialButtons providers={enabledProviders()} />
          <p className="foot"><Link href="/forgot">비밀번호를 잊으셨나요?</Link></p>
          <p className="foot">아직 파트너가 아니신가요? <Link href="/signup">가입 신청</Link></p>
        </div>
      </main>
    </>
  );
}
