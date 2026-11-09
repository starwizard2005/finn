import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // linkedom / unpdf are only used server-side
  serverExternalPackages: ["linkedom", "unpdf"],
};

export default nextConfig;
