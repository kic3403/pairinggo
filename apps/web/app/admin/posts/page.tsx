/**
 * 어드민 — 블로그 글 초안(2026-10-02). 모음 화면(/guide)의 순위를 네이버 블로그·티스토리에 올릴 글로 뽑아 둔다. 제목·본문을 따로 복사한다.
 * 글 규칙은 shared seo/blog-draft.ts(근거 있는 조합만, 남의 글 인용문은 싣지 않음, 링크에 utm_source=blog). 그림은 그 모음의 술·음식 상세 'SNS에 올리기' 카드를 쓴다.
 */
import Link from "next/link";
import { guideBlogDraft, guideContent, guideList, kstToday, weekLabel, weeklyCaption, weeklyTopByKind } from "@pairinggo/shared";
import { requireAdmin } from "@/lib/admin-auth";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
import CopyButton from "../../(site)/_components/CopyButton";

export const dynamic = "force-dynamic";

const GROUP: Record<string, string> = { "drink|category": "술 종류별", "drink|region": "지역별", "food|category": "음식 종류별", "food|tag": "맛별" };

export default async function AdminPosts() {
  await requireAdmin();
  const c = await getCatalog();
  const base = siteUrl();
  const today = kstToday();
  const drafts = guideList(c.dataset).map((g) => ({ g, d: guideBlogDraft(guideContent(c.dataset, g), base) }));
  const weekly = weeklyTopByKind(c.dataset.drinks, !!c.dataset.trend_meta?.compared_to);
  const groups = Object.keys(GROUP).map((k) => ({ k, items: drafts.filter((x) => `${x.g.side}|${x.g.by}` === k) })).filter((x) => x.items.length > 0);
  return (
    <>
      <h2 style={{ margin: "0 0 8px" }}>블로그 글 초안 <span className="muted">{drafts.length}편 · 오늘 {today}</span></h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        모음 화면의 순위로 만든 글입니다. <b>제목 복사</b> → <b>본문 복사</b>로 블로그에 붙여 넣고, 사진과 한두 줄 감상을 더해 올리세요.
        근거가 확인된 조합만 쓰고, 다른 사람 글의 문장은 옮겨 적지 않습니다(우리 설명과 출처 갈래만). 본문 링크로 들어온 방문은 대시보드 유입 경로에 "블로그"로 잡힙니다.
        그림은 글마다 있는 <b>그림 카드 받기</b>(그 글과 같은 다섯 가지)를 쓰고, 술·음식 하나를 따로 보여 주려면 그 상세 화면의 <b>SNS에 올리기 → 그림 카드 저장</b>을 쓰면 됩니다. 같은 글을 여러 번 올리지 말고 한 편씩 올리세요(검색엔진이 중복 글을 낮게 봅니다).
      </p>

      {weekly.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <b>이번 주 순위 글 <span className="muted" style={{ fontWeight: 400 }}>{weekLabel(today)} · 인스타·블로그 겸용</span></b>
          {weekly.map((t) => (
            <details key={t.kind} style={{ marginTop: 8 }}>
              <summary>많이 찾는 {t.label} TOP {t.rows.length} <span className="muted">— {t.rows.map((r) => r.drink.name).join(", ")}</span></summary>
              <pre className="draft">{weeklyCaption(t, today, base)}</pre>
              <div className="btns"><CopyButton text={weeklyCaption(t, today, base)} label="글 복사" /> <Link className="btn sm" href={`/weekly/${t.kind}/card.png`}>그림 카드 열기</Link></div>
            </details>
          ))}
        </div>
      )}

      {groups.map((x) => (
        <div key={x.k} className="card" style={{ marginBottom: 12 }}>
          <b>{GROUP[x.k]} <span className="muted" style={{ fontWeight: 400 }}>{x.items.length}편</span></b>
          {x.items.map(({ g, d }) => (
            <details key={g.slug} style={{ marginTop: 8 }}>
              <summary>{d.title} <span className="muted">— 근거 조합 {g.n}개</span></summary>
              <pre className="draft">{d.body}</pre>
              <div className="btns">
                <CopyButton text={d.title} label="제목 복사" /> <CopyButton text={d.body} label="본문 복사" /> <a className="btn sm" href={`/guide/${g.slug}/card.png`} download={`pairinggo-${g.slug}.png`}>그림 카드 받기</a> <Link className="btn sm" href={`/guide/${g.slug}`}>모음 화면 보기</Link>
              </div>
            </details>
          ))}
        </div>
      ))}
    </>
  );
}
