/* 페어링GO 서비스워커 — 설치 조건(홈 화면에 추가)을 채우기 위한 최소 구성. 캐시는 하지 않는다(카탈로그·평점이 자주 바뀌어 오래된 화면이 남으면 안 됨). 푸시는 나중에 여기에 붙인다. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* 네트워크 그대로 */ });
