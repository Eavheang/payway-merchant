import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'link.payway.com.kh',
        pathname: '/api/pw-app/v1/payment/gateway/download-qr',
        protocol: 'https',
      },
    ],
  },
};

export default nextConfig;
