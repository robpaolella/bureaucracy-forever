import type { NextConfig } from "next";
import { NOINDEX_HEADER } from "./lib/auth/gate";
import { isProductionDeployment } from "./lib/deploy-env";

const nextConfig: NextConfig = {
  // Stop `next dev` appending its agent-rules block to the root CLAUDE.md.
  agentRules: false,
  // Development only: Next blocks cross-origin requests to its dev resources (client
  // chunks, HMR) unless the host is listed. Without this, a browser on another machine
  // gets the server-rendered HTML but no JavaScript, so the header never learns who is
  // logged in. Add hosts here as needed; production builds ignore this setting.
  allowedDevOrigins: ["192.168.1.201", "localhost"],
  // Everything that is not production (staging, previews, a local build) tells search
  // engines not to index it. Here rather than in the proxy because this covers every
  // response, static assets included, while the proxy only runs on /members, /officers
  // and /api. Read at build time, which is when Vercel fixes VERCEL_ENV for a deployment.
  async headers() {
    if (isProductionDeployment()) return [];
    return [{ source: "/:path*", headers: [{ key: NOINDEX_HEADER[0], value: NOINDEX_HEADER[1] }] }];
  },
};

export default nextConfig;
