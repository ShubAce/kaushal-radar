import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The JSON artefacts in /data are read with fs at request time, so they must
  // be traced into every server bundle (pages and API routes alike).
  outputFileTracingIncludes: {
    "/*": ["./data/**/*.json"],
  },
  // The Python pipeline lives beside the app and is never bundled.
  outputFileTracingExcludes: {
    "/*": ["./pipeline/**/*"],
  },
};

export default nextConfig;
