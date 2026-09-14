import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pairinggo/shared"],
  reactStrictMode: true,
  poweredByHeader: false,
  // 프로젝트 루트 CLAUDE.md가 규칙의 단일 출처 — Next가 apps/web에 AGENTS.md/CLAUDE.md를 생성하지 않게
  agentRules: false,
  // 공유 이미지 한글 폰트(lib/fonts)를 Vercel 함수 번들에 포함 — opengraph-image.tsx가 readFile로 읽는다
  outputFileTracingIncludes: { "/**/opengraph-image": ["./lib/fonts/**"], "/opengraph-image": ["./lib/fonts/**"] },
};

export default config;
