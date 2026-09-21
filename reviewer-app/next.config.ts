import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Subject-Reviewer',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
