import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Traffic comes only from YouTube; keep every response out of search engines.
  // Pages also carry <meta name="robots"> and robots.txt disallows crawling.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" }],
      },
    ];
  },
};

export default nextConfig;
