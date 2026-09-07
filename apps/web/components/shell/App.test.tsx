import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App.tsx'
import { useStore } from '@/lib/store.ts'

function reset() {
  window.localStorage.clear()
  window.location.hash = ''
  useStore.setState({
    ready: false,
    plans: [],
    activeId: '',
    compareId: null,
    selection: null,
    vendorData: null,
    past: [],
    future: [],
    toast: null,
    dirty: false,
    lastEditAt: 0,
  })
}

describe('the application', () => {
  it('renders the landing page before anything is stored', async () => {
    reset()
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: /design a bitcoin custody plan/i })
    ).toBeInTheDocument()
    // The promise the whole product rests on is stated before anything is typed.
    expect(screen.getByText(/it refuses key material/i)).toBeInTheDocument()
    expect(screen.getByText(/it makes no network calls/i)).toBeInTheDocument()
  })

  it('opens a worked example and reports findings about it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByText('One signer, one backup'))

    // The example is deliberately a plan that fails, and the failure it is
    // meant to teach is that one place holds everything.
    expect(await screen.findByRole('heading', { name: 'Findings' })).toBeInTheDocument()
    expect(await screen.findByText(/Site A alone is enough to spend/i)).toBeInTheDocument()
  })

  it('starts an empty plan and offers the guided route', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /start a plan/i }))
    expect(await screen.findByRole('heading', { name: 'Purpose' })).toBeInTheDocument()
  })
})

describe('the input guard, in the interface', () => {
  it('refuses to store seed words typed into a label', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByText('One signer, one backup'))
    window.location.hash = '#/design/locations'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    const label = await screen.findByLabelText('Label')
    await user.clear(label)
    await user.type(label, 'legal winner thank year wave sausage worth useful')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/not stored/i)
    expect(alert).toHaveTextContent(/consecutive words from the BIP-39 wordlist/i)
    // The refusal must not repeat the thing it refused.
    expect(alert).not.toHaveTextContent('sausage')

    // And the plan itself must not have taken it.
    const plan = useStore
      .getState()
      .plans.find((entry) => entry.id === useStore.getState().activeId)
    expect(JSON.stringify(plan)).not.toContain('sausage')
  })

  it('accepts ordinary prose about a backup', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByText('One signer, one backup'))
    window.location.hash = '#/design/locations'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    const label = await screen.findByLabelText('Label')
    await user.clear(label)
    await user.type(label, 'Steel plate safe box')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('storage', () => {
  it('lists exactly what this origin holds, and erases it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByText('One signer, one backup'))
    window.location.hash = '#/file'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(await screen.findByText('outlive.diy/plan-file/v1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /erase everything/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /erase it/i }))

    expect(window.localStorage.length).toBe(0)
  })
})

describe('every view renders', () => {
  // The cheapest possible guard against a view that throws at runtime, which
  // is the one class of defect the type checker cannot see.
  const views: [string, RegExp][] = [
    ['#/overview', /two of three, three sites/i],
    ['#/design/locations', /^design$/i],
    ['#/design/people', /^design$/i],
    ['#/design/devices', /^design$/i],
    ['#/design/keys', /^design$/i],
    ['#/design/wallets', /^design$/i],
    ['#/design/checks', /^design$/i],
    ['#/design/profile', /^design$/i],
    ['#/findings', /^findings$/i],
    ['#/map', /^map$/i],
    ['#/scenarios', /stress test/i],
    ['#/runbook', /build runbook/i],
    ['#/recovery', /recovery routes/i],
    ['#/letter', /successor letter/i],
    ['#/compare', /compare plans/i],
    ['#/file', /your plan file/i],
    ['#/reasoning', /how it reasons/i],
    ['#/start', /purpose/i],
  ]

  for (const [hash, heading] of views) {
    it(`renders ${hash}`, async () => {
      reset()
      const user = userEvent.setup()
      render(<App />)
      await user.click(await screen.findByText('Two of three, three sites'))

      window.location.hash = hash
      window.dispatchEvent(new HashChangeEvent('hashchange'))

      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    })
  }
})

describe('the map and the findings agree', () => {
  it('paints a column red exactly when a finding says that place is enough', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('One signer, one backup'))

    // The findings say Site A alone is enough to spend.
    expect(await screen.findByText(/Site A alone is enough to spend/i)).toBeInTheDocument()

    window.location.hash = '#/map'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    // And the map's column for Site A says the same, in its own words.
    expect(await screen.findByTitle(/can be spent from this location alone/i)).toBeInTheDocument()
  })
})

describe('drafts', () => {
  it('forks a plan and compares the findings', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    window.location.hash = '#/overview'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await user.click(await screen.findByRole('button', { name: /try a change as a draft/i }))

    expect(useStore.getState().plans).toHaveLength(2)
    expect(useStore.getState().compareId).not.toBeNull()

    window.location.hash = '#/compare'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    // Nothing has been changed yet, so the two runs must be identical.
    expect(await screen.findByText(/the findings are identical/i)).toBeInTheDocument()
  })
})

describe('the scope statement', () => {
  it('is said once and then never again', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    const notice = await screen.findByText(/before you rely on any of this/i)
    expect(notice).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /understood/i }))
    expect(screen.queryByText(/before you rely on any of this/i)).not.toBeInTheDocument()

    // And it stays dismissed across a reload.
    window.location.hash = '#/map'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(screen.queryByText(/before you rely on any of this/i)).not.toBeInTheDocument()
  })
})

describe('rehearsing a recovery', () => {
  it('records a dated drill only once every step is ticked', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    window.location.hash = '#/recovery'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    const before = useStore.getState().plans[0].verifications.length
    // Routes with no recoverable path offer no rehearsal at all, so every
    // button on the page belongs to a route with steps.
    const buttons = await screen.findAllByRole('button', { name: /rehearse this route/i })
    expect(buttons.every((button) => !(button as HTMLButtonElement).disabled)).toBe(true)
    await user.click(buttons[0])

    // Not offered until the whole route has been walked.
    const partial = screen.getByRole('button', { name: /0 of \d+ done/i })
    expect(partial).toBeDisabled()

    for (const step of screen.getAllByRole('button', { pressed: false })) {
      await user.click(step)
    }
    await user.click(await screen.findByRole('button', { name: /record this as done today/i }))

    const after = useStore.getState().plans[0].verifications
    expect(after).toHaveLength(before + 1)
    expect(after[after.length - 1].lastVerifiedAt).not.toBeNull()
  })
})

describe('undo', () => {
  it('actually restores what was there before the edit', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('One signer, one backup'))

    window.location.hash = '#/design/locations'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    const before = useStore.getState().plans[0].locations[0].label
    // Opening the example is itself an undoable step, so stop above it.
    const floor = useStore.getState().past.length

    const label = await screen.findByLabelText('Label')
    await user.clear(label)
    await user.type(label, 'Site Z')
    expect(useStore.getState().plans[0].locations[0].label).toBe('Site Z')

    // Edits inside half a second are coalesced into one step, so a burst of
    // typing is one undo rather than one per character.
    expect(useStore.getState().past.length - floor).toBeLessThan(3)
    while (useStore.getState().past.length > floor) useStore.getState().undo()
    expect(useStore.getState().plans[0].locations[0].label).toBe(before)

    useStore.getState().redo()
    expect(useStore.getState().plans[0].locations[0].label).not.toBe(before)
  })
})

describe('composing a failure by hand', () => {
  it('agrees with the scenario table when the same thing is switched off', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    window.location.hash = '#/scenarios'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    const heading = await screen.findByRole('heading', { name: /compose your own/i })
    const panel = heading.closest('section') as HTMLElement
    const composer = within(panel)

    const vault = () => within(composer.getByText('Vault').closest('li') as HTMLElement)

    // Nothing switched off: the vault works, with a key to spare.
    expect(vault().getByText(/1 spare key beyond the threshold/i)).toBeInTheDocument()

    // Losing Site B alone is survivable: Key B's device is at Site A, so its
    // backup being unreachable does not take the key with it.
    await user.click(composer.getByRole('button', { name: 'Site B', pressed: false }))
    expect(vault().getByText(/survives/i)).toBeInTheDocument()

    // Site A as well, and there is neither a threshold nor a descriptor left.
    await user.click(composer.getByRole('button', { name: 'Site A', pressed: false }))
    expect(vault().getByText(/unspendable/i)).toBeInTheDocument()
    expect(vault().getByText(/configuration cannot be recovered/i)).toBeInTheDocument()
  })
})
