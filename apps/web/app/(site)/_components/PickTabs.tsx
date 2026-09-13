"use client";
/**
 * 페어링 목록의 묶음 탭 — 전체 · 전문가픽 · 대중픽 · 맛 분석.
 * 카드는 서버에서 모두 그려 두고(검색엔진·정적 생성용), 탭은 목록 감싸개의 data-show 값만 바꿔 CSS로 거른다.
 */
import { useState, type ReactNode } from "react";
import type { PickKey } from "@pairinggo/shared/pick";

type Tab = "all" | PickKey;
const LABEL: Record<Tab, string> = { all: "전체", expert: "전문가픽", public: "대중픽", member: "회원픽", profile: "맛 분석" };
const HINT: Record<Tab, string> = {
  all: "",
  expert: "양조장과 소믈리에·명인이 직접 추천한 조합입니다.",
  public: "블로그·유튜브 후기와 매체 보도에서 확인된 조합입니다.",
  member: "페어링GO 회원 여러 명이 직접 추천한 조합입니다.",
  profile: "근거 글 없이 술과 음식의 맛 프로필로 계산한 추정입니다.",
};

export default function PickTabs({ counts, children }: { counts: Record<PickKey, number>; children: ReactNode }) {
  const [tab, setTab] = useState<Tab>("all");
  const total = counts.expert + counts.public + counts.member + counts.profile;
  const tabs: Tab[] = (["all", "expert", "public", "member", "profile"] as Tab[]).filter((t) => t !== "member" || counts.member > 0);   // 회원픽은 있을 때만 탭을 보인다
  return (
    <div className="pick-wrap" data-show={tab}>
      <ul className="tabs pick-tabs" role="tablist" aria-label="추천 묶음">
        {tabs.map((t) => {
          const n = t === "all" ? total : counts[t];
          return (
            <li key={t}>
              <button type="button" role="tab" aria-selected={tab === t} className={`${t}${tab === t ? " on" : ""}`} disabled={t !== "all" && n === 0} onClick={() => setTab(t)}>
                {LABEL[t]}<span className="cnt">{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {HINT[tab] && <p className="small muted pick-hint">{HINT[tab]}</p>}
      {children}
    </div>
  );
}
