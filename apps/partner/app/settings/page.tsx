import { getClosures, getHours, getSettings } from "@pairinggo/server/merchant-store";
import { kstParts } from "@pairinggo/shared";
import { Bar, Tabs } from "../_bar";
import { requireApprovedMerchant } from "@/lib/partner";
import { ClosuresForm, HoursForm, SettingsForm } from "./SettingsForms";

export const metadata = { title: "예약 설정" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { merchant } = await requireApprovedMerchant();
  const [settings, hours, closures] = await Promise.all([getSettings(merchant.id), getHours(merchant.id), getClosures(merchant.id)]);
  return (
    <>
      <Bar store={merchant.name} signedIn />
      <main className="stack">
        <div>
          <h1>예약 설정</h1>
          <p className="lead" style={{ margin: 0 }}>정한 정원 안에서 들어온 예약은 사장님 확인 없이 바로 확정돼요. 받을 수 없는 날은 휴무로 막아 주세요.</p>
        </div>
        <SettingsForm initial={settings} hoursSaved={hours.saved && hours.hours.some((h) => !h.closed)} />
        <HoursForm initial={hours.hours} slotMinutes={settings.slotMinutes} />
        <ClosuresForm initial={closures} today={kstParts(new Date()).date} />
      </main>
      <Tabs active="settings" />
    </>
  );
}
