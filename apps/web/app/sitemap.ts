import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://outlive.diy'

export const dynamic = 'force-static'

// One document. Every view inside it is a fragment, and fragments are not
// separate pages as far as anything crawling this is concerned.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: 'monthly', priority: 1 }]
}
