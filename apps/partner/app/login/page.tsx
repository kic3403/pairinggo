import Link from "next/link";
import { redirect } from "next/navigation";
import { Bar } from "../_bar";
import { currentPartner } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "로그인" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentPartner()) redirect("/");
  return (
    <>
      <Bar />
      <main>
        <div className="auth">
          <h1>파트너 로그인</h1>
          <p className="lead">페어링GO로 들어온 예약을 확인하고 매장 정보를 관리해요.</p>
          <LoginForm />
          <p className="foot">아직 파트너가 아니신가요? <Link href="/signup">가입 신청</Link></p>
        </div>
      </main>
    </>
  );
}
