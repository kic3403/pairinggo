/// <reference lib="dom" />
/**
 * 웹 푸시 구독(브라우저 쪽) — 페어링GO·파트너 앱 공용. 서버 저장은 각 앱의 /api/push.
 * 아이폰은 홈 화면에 추가한 앱(PWA)에서만 된다(iOS 16.4+) — 그 밖의 아이폰 사파리는 "unsupported"로 안내.
 */
export type PushSupport = "ok" | "unsupported" | "ios-install" | "denied";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

const b64ToBytes = (b64: string) => {
  const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** 지금 이 기기가 구독 중인가 */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** 권한을 묻고 구독 → 서버에 저장. 실패하면 이유 문장 */
export async function subscribePush(vapidPublicKey: string, saveUrl = "/api/push"): Promise<{ ok: true } | { ok: false; problem: string }> {
  const sup = pushSupport();
  if (sup === "ios-install") return { ok: false, problem: "아이폰은 공유 버튼 → ‘홈 화면에 추가’로 설치한 앱에서 알림을 받을 수 있어요" };
  if (sup === "denied") return { ok: false, problem: "알림이 꺼져 있어요 — 브라우저 설정에서 이 사이트 알림을 허용해 주세요" };
  if (sup !== "ok" || !vapidPublicKey) return { ok: false, problem: "이 브라우저에서는 알림을 받을 수 없어요" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, problem: "알림을 허용해야 받을 수 있어요" };
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidPublicKey) }));
  const r = await fetch(saveUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) }).catch(() => null);
  if (!r?.ok) return { ok: false, problem: "알림 설정을 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요" };
  return { ok: true };
}

export async function unsubscribePush(saveUrl = "/api/push"): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch(saveUrl, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => null);
  await sub.unsubscribe().catch(() => null);
}
