import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` appending its agent-rules block to the root CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
