/** 어드민 — 공지(2026-09-26, docs/25 §6): 헤더 알림 버튼의 '공지' 탭에 보이는 글. 기간·켜기/끄기. */
import { NOTICE_KIND_LABEL } from "@pairinggo/shared";
import { requireAdmin } from "@/lib/admin-auth";
import { adminNotices } from "@/lib/notifications";
import NoticeEditor from "./NoticeEditor";

export const dynamic = "force-dynamic";

export default async function AdminNotices() {
  await requireAdmin();
  const rows = await adminNotices();
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>공지 <span className="muted">{rows.length}개 · 켜짐 {rows.filter((r) => r.active).length}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>헤더의 🔔 알림 버튼 ‘공지’ 탭에 보입니다(켜져 있고 기간 안인 것, 최신순 20개). 새 공지가 오면 회원·비회원 모두의 버튼에 빨간 배지가 뜹니다(기기별로 한 번 열면 사라짐). 링크는 사이트 안 주소(/events 등)나 https만.</p>
      <NoticeEditor rows={rows} kinds={Object.entries(NOTICE_KIND_LABEL).map(([id, label]) => ({ id, label }))} />
    </>
  );
}
