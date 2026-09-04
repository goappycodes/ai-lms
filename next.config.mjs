import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next build` and `next dev` both write to .next by default, so running the
  // verification suite while a dev server is up leaves that server holding a
  // directory the build has overwritten underneath it. The symptom is
  // "Cannot find the middleware module", or an empty middleware manifest, from
  // a page that is perfectly fine — and the error points at the wrong file.
  //
  // `npm run verify` sets NEXT_DIST_DIR so the two never share a directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Node-only packages (DB driver, S3 client) must stay external to the bundle.
    serverComponentsExternalPackages: ["@aws-sdk/client-s3", "pg"],
    // Next 14 needs this to load instrumentation.ts, where Sentry starts.
    instrumentationHook: true,
  },
  webpack(config, { webpack, isServer }) {
    // Tree-shake the parts of Sentry we deliberately do not use. Without
    // these the tracing and debug code ships to every student's phone even
    // though tracesSampleRate is 0. Browser bundle only — the server has no
    // bandwidth cost and tracing there may be useful later.
    if (!isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          __SENTRY_DEBUG__: false,
          __SENTRY_TRACING__: false,
        })
      );
    }
    return config;
  },
};

// Source maps are uploaded only when an auth token is present, so builds work
// for anyone who has not set one — including CI and a fresh clone.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Readable stack traces from minified production code.
  sourcemaps: { disable: !uploadSourceMaps },
  // Strip the source maps from the deployed bundle after upload, so they are
  // not downloadable by students.
  widenClientFileUpload: false,
  // Strips Sentry's own debug logging from the browser bundle.
  webpack: { treeshake: { removeDebugLogging: true } },
  // Proxy Sentry's ingest through our own domain so ad blockers, which many
  // school networks run, do not silently drop every error report.
  tunnelRoute: "/monitoring",
});
