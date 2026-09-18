import Link from "next/link";
import { redirect } from "next/navigation";
import { Bar } from "../_bar";
import { currentPartner } from "@/lib/session";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "가입 신청" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await currentPartner()) redirect("/");
  return (
    <>
      <Bar />
      <main>
        <div className="auth">
          <h1>파트너 가입 신청</h1>
          <p className="lead">신청하시면 운영자가 매장·사업자 정보를 확인한 뒤 승인해 드려요. 승인되면 페어링GO 손님이 이 매장을 바로 예약할 수 있어요.</p>
          <SignupForm />
          <p className="foot">이미 가입하셨나요? <Link href="/login">로그인</Link></p>
        </div>
      </main>
    </>
  );
}
