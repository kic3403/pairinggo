import { useEffect } from "react";
import { pushRecent } from "@/lib/prefs";

/** 술/음식 상세 페이지 방문을 최근 검색으로 기록 (연관 추천 탭의 입력) */
export default function RecentTracker({ type, id, name }: { type: "drink" | "food"; id: string; name: string }) {
  useEffect(() => { pushRecent({ type, id, name }); }, [type, id, name]);
  return null;
}
