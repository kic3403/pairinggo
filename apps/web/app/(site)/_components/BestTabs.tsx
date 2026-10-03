"use client";
/** 종류별 BEST 페어링의 탭 — 서버가 그린 패널(data-key) 가운데 고른 것 하나만 보인다. 첫 탭이 기본 */
import { Children, isValidElement, useState, type ReactNode } from "react";

export default function BestTabs({ tabs, children }: { tabs: { key: string; label: string }[]; children: ReactNode }) {
  const [cur, setCur] = useState(tabs[0]?.key ?? "");
  const panels = Children.toArray(children).filter(isValidElement) as React.ReactElement<{ "data-key"?: string }>[];
  const panel = panels.find((p) => p.props["data-key"] === cur) ?? panels[0];
  return (
    <div className="best-tabs-wrap">
      <div className="best-tabs" role="tablist">
        {tabs.map((t) => <button key={t.key} type="button" role="tab" aria-selected={cur === t.key} className={cur === t.key ? "on" : undefined} onClick={() => setCur(t.key)}>{t.label}</button>)}
      </div>
      {panel}
    </div>
  );
}
