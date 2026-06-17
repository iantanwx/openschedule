import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@openschedule/ui"],
  typescript: {
    // Type checking is handled by `pnpm typecheck` — skip during build
    // to avoid false failures from pre-existing codegen-dependent types.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
