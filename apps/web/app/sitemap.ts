import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://outlive.diy'

export const dynamic = 'force-static'

// The landing page and the terms. The app is a document of its own at /app/,
// but it holds nothing a crawler could read: a plan lives in the visitor's
// browser.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/terms/`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
