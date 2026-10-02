"use client";
/**
 * 홈 "종류별 페어링 모음" 칩 줄 맨 앞에 그날 상황의 모음("☔ 비 오는 날 막걸리 안주 추천") 한 칸(2026-10-02, docs/29 §5-1 입구).
 * 홈은 정적으로 만들어 두므로 브라우저에서 받아 끼운다(useSituation — WeatherPick과 같은 주소라 두 번 묻지 않는다). 없으면 아무것도 안 그린다.
 */
import Link from "next/link";
import { track } from "@/lib/track";
import { useSituation } from "./useSituation";

export default function SituationChip() {
  const data = useSituation("home", undefined, 1);
  if (!data?.guide) return null;
  const s = data.situation;
  return (
    <li>
      <Link href={`/guide/${data.guide.slug}`} className="s" onClick={() => track("situation_click", { key: s.key, mode: "home", what: "chip", weather: s.fromWeather, sido: s.sido })}>
        {s.icon} {data.guide.h1}
      </Link>
    </li>
  );
}
