import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/pos/admin/secure/control-panel/love-and-happy",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
