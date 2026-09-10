export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 380, margin: "60px auto" }}>
      <b style={{ fontSize: 18 }}>운영 어드민 로그인</b>
      <p className="muted">검수·발행은 운영자만 할 수 있어요.</p>
      <form method="post" action="/admin/api/login" style={{ marginTop: 12 }}>
        <label>비밀번호</label>
        <input type="password" name="password" autoFocus required />
        {e && <p style={{ color: "var(--food-ink)", fontSize: 13 }}>비밀번호가 맞지 않아요.</p>}
        <button className="btn p" style={{ marginTop: 10, width: "100%" }} type="submit">들어가기</button>
      </form>
    </div>
  );
}
