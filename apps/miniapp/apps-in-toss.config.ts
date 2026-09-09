import { defineConfig } from "@apps-in-toss/web-framework/config";

/**
 * 앱인토스 SDK 3.x 설정.
 * appName은 콘솔에 등록한 값과 같아야 한다 (딥링크 intoss://pairinggo).
 * 위치 권한(geolocation)은 Phase 3에서 permissions에 추가.
 */
export default defineConfig({
  appName: "pairinggo",
  brand: {
    primaryColor: "#22406B",
  },
  webView: {},
  permissions: [],
  webBundleDir: "dist",
});
