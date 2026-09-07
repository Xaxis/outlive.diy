import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

/**
 * Installable, which matters more here than it usually does: an installed copy
 * keeps working when the network does not, and this application never needed
 * the network in the first place.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'outlive.diy',
    short_name: 'outlive',
    description:
      'Design a Bitcoin self-custody and recovery plan and find where it breaks. Local only, no network calls, never accepts key material.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08090b',
    theme_color: '#08090b',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
