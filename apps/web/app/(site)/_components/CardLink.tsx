"use client";
/** 페어링 카드의 이름 링크 — 누르면 card_tap {d, f} 를 남긴다(요즘 핫한 페어링·pairing_feedback 입력). */
import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/track";

export default function CardLink({ href, d, f, from, className, children }: { href: string; d: string; f: string; from: "drink" | "food"; className?: string; children: ReactNode }) {
  return <Link href={href} className={className} onClick={() => track("card_tap", { d, f, from })}>{children}</Link>;
}
