import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import aitDevtools from "@apps-in-toss/devtools/unplugin";
import { fileURLToPath, URL } from "node:url";

// AIT Devtools: 로컬 브라우저에서 토스 앱 환경(로그인·SDK)을 흉내 내 테스트한다 (SDK 3.x는 샌드박스 앱 없음)
export default defineConfig({
  plugins: [aitDevtools.vite(), react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
    // 데이터(pairings.json 0.5MB)를 번들에 내장하므로 단일 청크가 크다. Phase 2에서 Supabase로 옮기면 사라진다.
    chunkSizeWarningLimit: 1200,
  },
});
