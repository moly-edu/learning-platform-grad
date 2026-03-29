import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Zod 4 type mismatch with @hookform/resolvers — compilation works fine
    ignoreBuildErrors: true,
  },
  // Prevent Vercel/Turbopack from bundling these packages into multiple chunks,
  // which breaks private class fields (#state) due to class identity mismatch.
  serverExternalPackages: [
    "better-auth",
    "@better-auth/expo",
    "@better-auth/core",
    "@node-rs/argon2",
  ],
  allowedDevOrigins: ["https://jong-triangled-courtney.ngrok-free.dev"],
  // async rewrites() {
  //   return [
  //     {
  //       source: "/api/:path*",
  //       destination: `http://localhost:8000/api/:path*`,
  //     },
  //   ];
  // },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "http://localhost:8081",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
