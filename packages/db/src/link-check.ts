/** 구매 링크 확인에 쓰는 이름 대조 — catalog-buy-links·retail-links가 함께 쓴다(2026-09-24) */
export const squash = (s: string) => (s || "").toLowerCase().replace(/[\s·,.\-()'"‘’]/g, "");
/** 이름의 낱말이 모두 글에 있는가 — "지리산 강쇠"는 "지리산 기운내린 강쇠 13도"에 있다고 본다(낱말 사이에 다른 말이 끼어도 됨) */
export const nameInText = (name: string, text: string) => {
  const words = name.split(/[\s·,]+/).map(squash).filter((w) => w.length >= 2);
  return words.length > 0 && words.every((w) => text.includes(w));
};
