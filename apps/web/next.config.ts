import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pairinggo/shared"],
  reactStrictMode: true,
  poweredByHeader: false,
  // 프로젝트 루트 CLAUDE.md가 규칙의 단일 출처 — Next가 apps/web에 AGENTS.md/CLAUDE.md를 생성하지 않게
  agentRules: false,
};

export default config;
