/** 페어링 등급 배지 — 숫자 점수 대신 찰떡 · 잘 어울림 · 시도해 볼 만. 점수와 구성은 툴팁(title)으로만. */
import type { Grade } from "@pairinggo/shared";

export default function GradeBadge({ grade, title }: { grade: Grade; title?: string }) {
  return <span className={`grade ${grade.key}`} title={title}>{grade.label}</span>;
}
