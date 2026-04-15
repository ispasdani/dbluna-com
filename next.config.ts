import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Tell Next.js/Turbopack NOT to bundle these native DB drivers.
  // They are resolved by Node at runtime only when actually used,
  // so an uninstalled optional driver (e.g. oracledb) won't cause
  // a build-time "Module not found" error.
  serverExternalPackages: ["mysql2", "pg", "mssql"],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;
