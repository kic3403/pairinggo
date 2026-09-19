"use client";
/** 매장 대표 사진(파트너가 올린 최대 10장) — 가로로 넘기는 줄, 누르면 크게(←→·Esc) */
import { useEffect, useRef, useState } from "react";

export default function StoreGallery({ photos, name }: { photos: string[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open != null && !d.open) d.showModal();
    if (open == null && d.open) d.close();
  }, [open]);
  const go = (step: number) => setOpen((i) => (i == null ? i : (i + step + photos.length) % photos.length));
  return (
    <>
      <div className={`pd-gallery${photos.length === 1 ? " one" : ""}`} aria-label={`${name} 사진 ${photos.length}장`}>
        {photos.map((u, i) => (
          <button key={u} type="button" className="pd-shot" onClick={() => setOpen(i)} aria-label={`사진 ${i + 1} 크게 보기`}>
            <img src={u} alt={`${name} 사진 ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} decoding="async" />
          </button>
        ))}
      </div>
      <dialog ref={dlg} className="pd-lightbox" onClose={() => setOpen(null)} onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}
        onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}>
        {open != null ? (
          <>
            <img src={photos[open]} alt={`${name} 사진 ${open + 1}`} />
            <div className="pd-lb-bar">
              {photos.length > 1 ? <button type="button" onClick={() => go(-1)} aria-label="이전 사진">‹</button> : null}
              <span>{open + 1} / {photos.length}</span>
              {photos.length > 1 ? <button type="button" onClick={() => go(1)} aria-label="다음 사진">›</button> : null}
              <button type="button" onClick={() => setOpen(null)} aria-label="닫기">✕</button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
