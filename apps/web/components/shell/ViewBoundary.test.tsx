import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ViewBoundary } from './ViewBoundary.tsx'

function Throws(): never {
  throw new Error('a shape this view never met')
}

describe('a view that breaks', () => {
  it('is replaced by a way to keep the plan, not by a blank page', () => {
    // React logs the caught error; it is expected here.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ViewBoundary>
        <Throws />
      </ViewBoundary>
    )
    quiet.mockRestore()
    expect(screen.getByRole('alert')).toHaveTextContent(/your plan is untouched/i)
    expect(screen.getByRole('button', { name: /save the plan file/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go to the overview/i })).toBeInTheDocument()
    expect(screen.getByText(/a shape this view never met/)).toBeInTheDocument()
  })
})
