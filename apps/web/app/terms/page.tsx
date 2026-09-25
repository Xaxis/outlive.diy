import type { Metadata } from 'next'
import { TermsView } from '@/components/views/TermsView.tsx'
import { TermsHeader } from '@/components/shell/TermsHeader.tsx'

export const metadata: Metadata = {
  title: 'Terms of use and disclaimer · outlive.diy',
}

export default function TermsPage() {
  return (
    <>
      <TermsHeader />
      <TermsView />
    </>
  )
}
