/** 구매 링크 확인에 쓰는 이름 대조 — catalog-buy-links·retail-links가 함께 쓴다(2026-09-24) */
export const squash = (s: string) => (s || "").toLowerCase().replace(/[\s·,.\-()'"‘’]/g, "");
/** 이름의 낱말이 모두 글에 있는가 — "지리산 강쇠"는 "지리산 기운내린 강쇠 13도"에 있다고 본다(낱말 사이에 다른 말이 끼어도 됨) */
export const nameInText = (name: string, text: string) => {
  const words = name.split(/[\s·,]+/).map(squash).filter((w) => w.length >= 2);
  return words.length > 0 && words.every((w) => text.includes(w));
};

/**
 * 첫 화면이 열리고 **그 술 이름이 보이는지** — 열리기만 하고 술이 없으면 found: null(사용자 규칙 2026-09-24).
 * 이름은 술 이름·별칭의 낱말이 모두 있는지로 본다(nameInText). 403·405로 막힌 곳은 글을 못 읽어 없음으로 본다.
 */
export async function showsDrink(url: string, names: string[]): Promise<{ url: string; found: string | null } | null> {
  const keys = names.filter((n) => squash(n).length >= 2);
  const try1 = url.replace(/^http:/, "https:"), try2 = url.replace(/^https:/, "http:");
  for (const u of [try1, try2]) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(u, { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (pairinggo link check)" } });
      clearTimeout(t);
      if (!(r.status < 400 || r.status === 403 || r.status === 405)) continue;
      const html = r.status < 400 ? await r.text().catch(() => "") : "";
      const text = squash(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " "));
      return { url: u, found: keys.find((k) => nameInText(k, text)) ?? null };
    } catch { /* 다음 주소 */ }
  }
  return null;
}

