import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps client bundles from pulling in these libraries' full module
  // graphs — only the icons/components each file actually imports get
  // included, instead of the whole package.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
};

export default nextConfig;
