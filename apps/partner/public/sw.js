/* 페어링GO 파트너 서비스워커 — 홈 화면 설치 + 새 예약·손님 취소 알림(웹 푸시). 캐시는 하지 않는다(예약 화면이 오래된 채로 남으면 안 됨). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* 네트워크 그대로 */ });

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "페어링GO 파트너", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "페어링GO 파트너", { body: d.body || "", tag: d.tag, renotify: !!d.tag, requireInteraction: true, data: { url: d.url || "/" }, icon: "/icon.svg" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
