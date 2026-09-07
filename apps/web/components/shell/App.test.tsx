import { describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App.tsx'
import { useStore } from '@/lib/store.ts'

/** Navigate the fragment router the way the address bar would. */
function goto(hash: string) {
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

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
    goto('#/design/locations')

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
    goto('#/design/locations')

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
    goto('#/file')

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

      goto(hash)

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

    goto('#/map')

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

    goto('#/overview')
    await user.click(await screen.findByRole('button', { name: /try a change as a draft/i }))

    expect(useStore.getState().plans).toHaveLength(2)
    expect(useStore.getState().compareId).not.toBeNull()

    goto('#/compare')
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
    goto('#/map')
    expect(screen.queryByText(/before you rely on any of this/i)).not.toBeInTheDocument()
  })
})

describe('rehearsing a recovery', () => {
  it('records a dated drill only once every step is ticked', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/recovery')

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

    goto('#/design/locations')

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

    goto('#/scenarios')

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

describe('an empty plan', () => {
  // A derived page given nothing is technically correct and completely
  // misleading, so every one of them has to say so rather than go quiet.
  const derived: [string, string][] = [
    ['#/findings', 'the silence below means nothing'],
    ['#/map', 'nothing to place on it'],
    ['#/scenarios', 'nothing to take away from it'],
    ['#/runbook', 'no steps to order'],
    ['#/recovery', 'nothing that could go wrong'],
  ]

  for (const [hash, phrase] of derived) {
    it(`says so on ${hash}`, async () => {
      reset()
      const user = userEvent.setup()
      render(<App />)
      await user.click(await screen.findByRole('button', { name: /start a plan/i }))

      goto(hash)

      expect(await screen.findByText(/nothing to work from yet/i)).toBeInTheDocument()
      expect(screen.getByText(new RegExp(phrase, 'i'))).toBeInTheDocument()
    })
  }

  it('never claims a clean bill of health for it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /start a plan/i }))

    goto('#/findings')

    expect(await screen.findByText(/nothing to work from yet/i)).toBeInTheDocument()
    // "Nothing found" is the clean-bill-of-health heading, and it must not
    // appear for a plan that has not been described. (The one-time scope notice
    // uses similar words on purpose, so match the heading rather than prose.)
    expect(screen.queryByRole('heading', { name: /nothing found/i })).not.toBeInTheDocument()
  })
})

describe('linking to one finding', () => {
  it('opens it, from the overview, in a list of twenty-three', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/overview')
    // Wait for the overview to actually be on screen. The findings list has a
    // button with the same name, so clicking before the switch lands would
    // silently test the wrong thing.
    await screen.findByRole('heading', { name: /two of three, three sites/i })

    await user.click(
      screen.getByRole('button', { name: /losing site a makes vault and daily unspendable/i })
    )

    // The list is open at that finding, with its remediation showing, rather
    // than at the top with everything folded away.
    expect(
      await screen.findByText(/place a further independent copy of the key material/i)
    ).toBeInTheDocument()
    expect(window.location.hash).toContain('L001')
  })
})

describe('naming a plan', () => {
  it('can be renamed after it exists, and the new name sticks', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /start a plan/i }))

    goto('#/design/profile')
    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Household vault')

    const plans = useStore.getState().plans
    expect(plans[0].name).toBe('Household vault')

    // And it is what the switcher and every printed page will say.
    expect(await screen.findAllByText(/household vault/i)).not.toHaveLength(0)
  })

  it('refuses a name that is key material, like every other field', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /start a plan/i }))

    goto('#/design/profile')
    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'legal winner thank year wave sausage worth useful')

    expect(await screen.findByRole('alert')).toHaveTextContent(/not stored/i)
    expect(JSON.stringify(useStore.getState().plans)).not.toContain('sausage')
  })
})

describe('a change that closes nothing', () => {
  it('says which findings about that thing are still standing', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/overview')
    await screen.findByRole('heading', { name: /two of three, three sites/i })
    await user.click(screen.getByRole('button', { name: /try a change as a draft/i }))

    // Move the bank box out of the home city. It looks like the fix for
    // "the quorum is concentrated in Home city" and it is not: two of the
    // three keys have material at home, so the group is still concentrated.
    goto('#/design/locations')
    await user.click(await screen.findByText('Site B'))
    const group = await screen.findByLabelText('Disaster group')
    await user.clear(group)
    await user.type(group, 'Second city')

    goto('#/compare')
    expect(await screen.findByText(/the findings are identical/i)).toBeInTheDocument()
    expect(await screen.findByText(/still standing, about what you changed/i)).toBeInTheDocument()
    expect(await screen.findByText(/concentrated in "Home city"/i)).toBeInTheDocument()
  })
})

describe('keeping a plan current', () => {
  it('marks an overdue check done in one click, and the finding goes', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/findings')
    expect(
      await screen.findByText(/a backup restore test is \d+ days overdue/i)
    ).toBeInTheDocument()

    goto('#/design/checks')
    const [check] = await screen.findAllByText(/restore a backup and check it matches/i)
    await user.click(check)
    await user.click(await screen.findByRole('button', { name: /done today/i }))

    const plan = useStore.getState().plans[0]
    const done = plan.verifications.find((entry) => entry.id === 'ver_restore_a')
    expect(done?.lastVerifiedAt).toBe(new Date().toISOString().slice(0, 10))

    // And the finding that was about it is gone from the list.
    goto('#/findings')
    expect(screen.queryByText(/a backup restore test is \d+ days overdue/i)).not.toBeInTheDocument()
  })
})

describe('opening a file over unsaved work', () => {
  const file = JSON.stringify({
    schemaVersion: 1,
    generator: 'test',
    savedAt: '2026-03-01',
    plans: [
      {
        schemaVersion: 1,
        id: 'plan_opened',
        name: 'Opened from disk',
        kind: 'current',
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      },
    ],
    activePlanId: 'plan_opened',
  })

  async function pick(user: ReturnType<typeof userEvent.setup>) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File([file], 'plan.json', { type: 'application/json' }))
  }

  it('asks before replacing changes that are not saved', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    // Make a change, so there is something to lose.
    goto('#/design/profile')
    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Mine')
    expect(useStore.getState().dirty).toBe(true)

    goto('#/file')
    await pick(user)

    expect(await screen.findByRole('dialog')).toHaveTextContent(/close what is open first/i)
    expect(useStore.getState().plans[0].name).toBe('Mine')

    await user.click(screen.getByRole('button', { name: /keep what i have/i }))
    expect(useStore.getState().plans[0].name).toBe('Mine')
  })

  it('opens without asking when there is nothing to lose', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await pick(user)

    expect(await screen.findByText(/opened the plan/i)).toBeInTheDocument()
    expect(useStore.getState().plans[0].name).toBe('Opened from disk')
  })
})
