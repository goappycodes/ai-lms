/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Node-only packages (DB driver, S3 client) must stay external to the bundle.
  experimental: {
    serverComponentsExternalPackages: ["@aws-sdk/client-s3", "pg"],
  },
};

export default nextConfig;
