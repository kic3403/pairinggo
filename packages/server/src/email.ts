/**
 * 이메일 보내기(2026-10-01) — Resend HTTP API(https://resend.com). SDK 없이 fetch로.
 * 환경변수: RESEND_API_KEY(서버 전용), EMAIL_FROM(없으면 Resend 시험 주소 — 계정 주인에게만 감). 키가 없으면 보내지 않고 건너뛴 사실만 돌려준다.
 * 지금은 운영자 주간 리포트에만 쓴다. 회원에게 보내려면 도메인(pairinggo.kr) 인증을 먼저 한다.
 */
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(input: { to: string | string[]; subject: string; text: string; html?: string }): Promise<{ ok: true; id: string } | { ok: false; skipped?: boolean; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: "RESEND_API_KEY 없음" };
  const from = process.env.EMAIL_FROM || "페어링GO <onboarding@resend.dev>";
  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (!to.length || to.some((t) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t))) return { ok: false, error: "받는 주소가 올바르지 않아요" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: input.subject, text: input.text, ...(input.html ? { html: input.html } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!r.ok) return { ok: false, error: `${r.status} ${j.message || j.name || ""}`.trim() };
    return { ok: true, id: String(j.id ?? "") };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
