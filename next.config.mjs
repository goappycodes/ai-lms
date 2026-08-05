/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native / node-only packages used by the video pipeline and DB must not be
  // bundled by webpack for server components / route handlers.
  experimental: {
    serverComponentsExternalPackages: ["@aws-sdk/client-s3"],
  },
};

export default nextConfig;
