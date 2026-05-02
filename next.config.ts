import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'pwapp.ababank.com',
        pathname: '/api/pw-app/v1/payment/gateway/download-qr',
        protocol: 'https',
      },
    ],
  },
};

export default nextConfig;
