/**
 * 현재 위치 — 토스 앱 안에서는 앱인토스 SDK(Device.getLocation), 브라우저에서는 navigator.geolocation.
 * 결과는 관심지역 스토어(setGps)에 저장한다. 실패·거부는 null (호출자가 관심지역으로 폴백).
 */
import { Accuracy, Device, GetCurrentLocationPermissionError, getOperationalEnvironment } from "@apps-in-toss/web-framework";
import { setGps } from "./prefs";

export type Coords = { lat: number; lng: number };
export type LocationStatus = "unknown" | "granted" | "denied" | "unavailable";
let lastStatus: LocationStatus = "unknown";
export const locationStatus = () => lastStatus;

/** 토스 앱(웹뷰) 안인지 — SDK가 환경을 알려준다. 알 수 없으면 브라우저로 간주 */
export function inToss(): boolean {
  try { const env = getOperationalEnvironment(); return env === "toss" || env === "sandbox"; } catch { return false; }
}

function viaBrowser(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { lastStatus = "unavailable"; resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { lastStatus = "granted"; resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { lastStatus = "denied"; resolve(null); },
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
}

async function viaToss(): Promise<Coords | null> {
  const ask = async () => { const l = await Device.getLocation({ accuracy: Accuracy.Balanced }); return { lat: l.coords.latitude, lng: l.coords.longitude }; };
  try { const c = await ask(); lastStatus = "granted"; return c; }
  catch (e) {
    if (e instanceof GetCurrentLocationPermissionError) {
      try {
        await Device.getLocation.openPermissionDialog();
        const c = await ask(); lastStatus = "granted"; return c;
      } catch { lastStatus = "denied"; return null; }
    }
    lastStatus = "unavailable"; return null;
  }
}

/** 현재 위치 1회. 성공 시 관심지역 스토어에 저장 */
export async function getCurrentPosition(): Promise<Coords | null> {
  const c = inToss() ? await viaToss() : await viaBrowser();
  if (c) setGps(c.lat, c.lng);
  return c;
}
