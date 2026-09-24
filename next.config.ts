import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * News covers hosted on Cloudinary are optimised like local ones. The
     * pattern is the delivery host with no query string, which is exactly what
     * `isOptimizableCover` in `src/lib/news/types.ts` checks before it lets
     * `next/image` optimise a URL — keep the two in step. Any other https host
     * an editor pastes is rendered `unoptimized` instead of being added here,
     * so this list never has to grow for the site to show a picture.
     */
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**", search: "" },
    ],
  },
};

export default nextConfig;
