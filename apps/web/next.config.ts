import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * A static export, not a server.
   *
   * The whole application is one HTML document with no back end, no API routes
   * and nothing to render on demand. That is not a deployment convenience: it
   * is what makes "this app cannot send your plan anywhere" a checkable claim
   * rather than a promise, because there is nowhere for it to be sent to.
   */
  output: 'export',
  reactStrictMode: true,
  // The engine is consumed as TypeScript source rather than a build artefact,
  // so that a change to it is one edit rather than an edit and a rebuild.
  transpilePackages: ['@outlive/core'],
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  // `next dev` and `next build` share a directory by default, and a dev server
  // left running rewrites a production build's manifests underneath it.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: { unoptimized: true },
}

export default nextConfig
