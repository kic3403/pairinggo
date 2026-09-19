import Link from "next/link";
import { Bar } from "../_bar";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "비밀번호 찾기" };

export default function ForgotPage() {
  return (
    <>
      <Bar />
      <main>
        <div className="auth">
          <h1>비밀번호 찾기</h1>
          <p className="lead">가입한 이메일과 담당자 휴대폰 번호를 넣으면 문자로 인증번호를 보내 드려요.</p>
          <ForgotForm contact="kic3403@gmail.com" />
          <p className="foot"><Link href="/login">로그인으로 돌아가기</Link></p>
        </div>
      </main>
    </>
  );
}
