import { App } from '@/components/shell/App.tsx'

/**
 * One route, one document.
 *
 * Views are fragments rather than pages, so the application never requests
 * anything after it has loaded, which is what lets the security policy forbid
 * connecting anywhere at all.
 */
export default function Page() {
  return <App />
}
