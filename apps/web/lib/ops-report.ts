/**
 * 주간 운영 리포트 이메일(2026-10-01) — 월요일 09:30 KST 크론(/api/cron/ops-report)이 최근 7일 지표와 회원 구성을 REPORT_EMAIL_TO로 보낸다.
 * 본문 규칙은 shared ops-metrics reportText. 키(RESEND_API_KEY)나 받는 주소가 없으면 보내지 않고 건너뛴 사실만 돌려준다.
 */
import { AGE_BANDS, METRIC_LABEL, METRIC_ORDER, deltaText, reportText } from "@pairinggo/shared";
import { emailConfigured, sendEmail } from "@pairinggo/server/email";
import { opsMetrics } from "./ops-metrics";

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

export async function weeklyOpsReport(opts: { dry?: boolean } = {}): Promise<{ sent: boolean; to: string; reason?: string; text: string }> {
  const { metrics: m, demo: d } = await opsMetrics();
  const text = reportText(m, d);
  const to = (process.env.REPORT_EMAIL_TO || "").trim();
  if (opts.dry) return { sent: false, to, reason: "미리보기", text };
  if (!to) return { sent: false, to, reason: "REPORT_EMAIL_TO 없음", text };
  if (!emailConfigured()) return { sent: false, to, reason: "RESEND_API_KEY 없음", text };
  const rows = METRIC_ORDER.map((k) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${METRIC_LABEL[k]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${m.cur[k].toLocaleString("ko-KR")}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#666">${m.prev[k].toLocaleString("ko-KR")}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${deltaText(m.cur[k], m.prev[k])}</td></tr>`).join("");
  const html = `<div style="font-family:'Malgun Gothic',sans-serif;color:#1F1E1C;max-width:560px">
<h2 style="margin:0 0 4px">페어링GO 주간 운영 리포트</h2>
<p style="margin:0 0 14px;color:#666">${m.since.slice(0, 10)} ~ ${m.until.slice(0, 10)} · 전주와 비교</p>
<table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th style="text-align:left;padding:6px 10px;color:#888;font-size:12px">항목</th><th style="text-align:right;padding:6px 10px;color:#888;font-size:12px">이번 주</th><th style="text-align:right;padding:6px 10px;color:#888;font-size:12px">전주</th><th style="text-align:right;padding:6px 10px;color:#888;font-size:12px">증감</th></tr>${rows}</table>
<h3 style="margin:18px 0 6px;font-size:15px">회원 ${d.total}명</h3>
<p style="margin:0 0 4px;font-size:14px">남 ${d.gender.m} · 여 ${d.gender.f} · 미입력 ${d.gender["?"]}</p>
<p style="margin:0 0 4px;font-size:14px">${AGE_BANDS.map((b) => `${b} ${d.age[b] ?? 0}`).join(" · ")}</p>
<p style="margin:0 0 14px;font-size:14px">${esc(d.sido.slice(0, 8).map((s) => `${s.name} ${s.n}`).join(" · "))}${d.sido.length > 8 ? " 외" : ""}</p>
<p style="font-size:13px"><a href="https://pairinggo.kr/admin" style="color:#22406B">어드민 대시보드에서 자세히 →</a></p>
</div>`;
  const r = await sendEmail({ to: to.split(",").map((s) => s.trim()).filter(Boolean), subject: `페어링GO 주간 리포트 ${m.until.slice(0, 10)} — 방문 ${m.cur.visitors} · 검색 ${m.cur.searches} · 새 회원 ${m.cur.newUsers}`, text, html });
  return r.ok ? { sent: true, to, text } : { sent: false, to, reason: r.error, text };
}
