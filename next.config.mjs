/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow fetching from RBI and government data sources
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "s-maxage=3600, stale-while-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
