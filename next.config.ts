import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` appending its agent-rules block to the root CLAUDE.md.
  agentRules: false,
  // Development only: Next blocks cross-origin requests to its dev resources (client
  // chunks, HMR) unless the host is listed. Without this, a browser on another machine
  // gets the server-rendered HTML but no JavaScript, so the header never learns who is
  // logged in. Add hosts here as needed; production builds ignore this setting.
  allowedDevOrigins: ["192.168.1.201", "localhost"],
};

export default nextConfig;
