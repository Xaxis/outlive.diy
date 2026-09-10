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
  /**
   * `make offline` builds a copy whose asset paths are relative, so that
   * `out/index.html` opens straight from a disk with no server at all. That is
   * worth having: the strongest possible demonstration that this program needs
   * nothing but a browser. It is not the default, because a relative prefix
   * resolves wrongly for the 404 document, which is served from paths that do
   * not exist.
   */
  assetPrefix: process.env.OUTLIVE_RELATIVE_ASSETS === '1' ? './' : undefined,
  images: { unoptimized: true },
  // `next dev` otherwise writes its own AGENTS.md and CLAUDE.md into this
  // workspace on every start. The instructions that matter are at the
  // repository root and are written by hand.
  agentRules: false,
}

export default nextConfig
