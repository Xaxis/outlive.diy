import { Landing } from '@/components/shell/Landing.tsx'

/**
 * `/`, always the landing page. The app is a separate document at `/app/`, and
 * moving between them is a page load rather than a client-side fetch, which is
 * what lets the security policy allow connecting to Anthropic and nothing else.
 */
export default function Page() {
  return <Landing />
}
