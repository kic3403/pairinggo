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
  },
});
