import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app ships as plain HTML/JS to a shared host: no Node process, no
  // server rendering, no middleware. Every route is emitted at build time and
  // the session is resolved in the browser instead.
  output: "export",

  // Emits `route/index.html` rather than `route.html`, which Apache and
  // LiteSpeed serve directly through DirectoryIndex — no rewrite rule needed
  // for ordinary pages.
  trailingSlash: true,

  // Keeps client bundles from pulling in these libraries' full module
  // graphs — only the icons/components each file actually imports get
  // included, instead of the whole package.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
};

export default nextConfig;
