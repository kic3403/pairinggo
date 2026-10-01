"use client";
/**
 * 비로그인 저장 목록 — SavedProvider가 들고 있는 기기 목록(localStorage)을 그대로 보여 준다.
 * 서버에 묻지 않는다(이름은 하트를 누를 때 함께 담아 둔 것). 로그인하면 계정으로 옮겨지므로 마이페이지로 보낸다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { guestSavedName, type GuestSavedItem } from "@pairinggo/shared/guest-saved";
import { toSlug } from "@pairinggo/shared/slug";
import Heart from "../_components/Heart";
import { useSaved, type SavedKind } from "../_components/SavedProvider";

const KINDS: { kind: SavedKind; label: string }[] = [{ kind: "drink", label: "주류" }, { kind: "food", label: "음식" }, { kind: "place", label: "음식점" }];
const hrefOf = (x: GuestSavedItem, name: string) =>
  x.kind === "drink" ? `/drinks/${toSlug(name)}` : x.kind === "food" ? `/foods/${toSlug(name)}` : `/places/${encodeURIComponent(x.id)}?n=${encodeURIComponent(name)}`;

export default function GuestSavedList() {
  const { ready, loggedIn, guest } = useSaved();
  const router = useRouter();
  const [tab, setTab] = useState<SavedKind>("drink");
  useEffect(() => { if (ready && loggedIn) router.replace("/my"); }, [ready, loggedIn, router]);
  // 처음 들어왔을 때 비어 있지 않은 첫 탭으로
  useEffect(() => { if (ready && !guest.some((x) => x.kind === tab)) { const k = KINDS.find((t) => guest.some((x) => x.kind === t.kind)); if (k) setTab(k.kind); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ready]);

  if (!ready || loggedIn) return <p className="muted" aria-busy="true">불러오는 중…</p>;
  const current = guest.filter((x) => x.kind === tab);

  return (
    <>
      <h1>저장한 것</h1>
      <div className="box guest-note">
        <p><b>이 기기에만 저장돼 있어요</b>{guest.length > 0 && <> · {guest.length}개</>}</p>
        <p className="small muted">로그인하면 계정으로 옮겨져 다른 기기에서도 볼 수 있고, 저장한 술의 새 소식도 받을 수 있어요. 브라우저 기록을 지우면 이 목록도 사라집니다.</p>
        <div className="btns">
          <Link className="btn p" href="/login?next=%2Fmy">로그인하고 옮기기</Link>
          <Link className="btn" href="/signup">회원가입</Link>
        </div>
      </div>

      <ul className="tabs">
        {KINDS.map((t) => (
          <li key={t.kind}>
            <button type="button" className={t.kind === tab ? "on" : ""} aria-pressed={t.kind === tab} onClick={() => setTab(t.kind)}>
              {t.label}<span className="cnt">{guest.filter((x) => x.kind === t.kind).length}</span>
            </button>
          </li>
        ))}
      </ul>

      {!current.length ? (
        <div className="box">
          <b>아직 저장한 것이 없어요.</b>
          <p className="small muted" style={{ marginTop: 6 }}>{tab === "place" ? "음식 화면에서 맛집을 찾아 하트를 누르면 여기에 모입니다." : "술·음식 화면의 하트를 누르면 여기에 모입니다."}</p>
          <div className="btns">
            {tab === "drink" ? <Link className="btn p" href="/drinks">주류 둘러보기</Link> : <Link className="btn f" href="/foods">음식으로 찾기</Link>}
          </div>
        </div>
      ) : (
        <ul className="grid">
          {current.map((x) => {
            const name = guestSavedName(x) || (x.kind === "place" ? "이름 없는 장소" : "");
            if (!name) return null;
            return (
              <li key={`${x.kind}:${x.id}`}>
                <Link href={hrefOf(x, name)}>
                  <span className="n">{name}</span>
                  {x.kind === "place" && <span className="s">{[x.meta?.category, x.meta?.address].filter(Boolean).join(" · ")}</span>}
                </Link>
                <Heart kind={x.kind} id={x.id} name={name} meta={x.meta} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
