import Link from "next/link";
import { redirect } from "next/navigation";
import { Bar } from "../_bar";
import { cookies } from "next/headers";
import { currentPartner } from "@/lib/session";
import { enabledProviders, PENDING_COOKIE, PROVIDER_LABEL, readPending } from "@/lib/oauth";
import { SocialButtons } from "../SocialButtons";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "가입 신청" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await currentPartner()) redirect("/");
  const pending = readPending((await cookies()).get(PENDING_COOKIE)?.value);
  const social = pending ? { provider: pending.provider, label: PROVIDER_LABEL[pending.provider], name: pending.name, phone: pending.phone, email: pending.email } : null;
  const providers = enabledProviders();
  return (
    <>
      <Bar />
      <main>
        <div className="auth">
          <h1>파트너 가입 신청</h1>
          <p className="lead">신청하시면 운영자가 매장·사업자 정보를 확인한 뒤 승인해 드려요. 승인되면 페어링GO 손님이 이 매장을 바로 예약할 수 있어요.</p>
          {!social && providers.length ? <SocialButtons providers={providers} verb="가입" /> : null}
          <SignupForm social={social} />
          <p className="foot">이미 가입하셨나요? <Link href="/login">로그인</Link></p>
        </div>
      </main>
    </>
  );
}
