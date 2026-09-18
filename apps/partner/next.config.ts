import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pairinggo/shared", "@pairinggo/server"],
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
};

export default config;
