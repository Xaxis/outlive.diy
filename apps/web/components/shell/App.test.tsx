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

  it('starts an empty plan on the first step of describing it', async () => {
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
    ['#/design/locations', /^places$/i],
    ['#/design/people', /^people$/i],
    ['#/design/devices', /^devices$/i],
    ['#/design/keys', /^keys$/i],
    ['#/design/wallets', /^wallets$/i],
    ['#/design/checks', /^checks$/i],
    ['#/design/profile', /^purpose$/i],
    ['#/findings', /^findings$/i],
    ['#/map', /^map$/i],
    // The stress test was folded into the map, and its links still land there.
    ['#/scenarios', /^map$/i],
    ['#/runbook', /build runbook/i],
    ['#/recovery', /recovery routes/i],
    ['#/letter', /successor letter/i],
    ['#/compare', /compare plans/i],
    ['#/file', /your plan file/i],
    ['#/reasoning', /how it reasons/i],
    // The guided route was folded into the design screens, and its links still
    // land on the step they named.
    ['#/start', /^purpose$/i],
    ['#/start/keys', /^keys$/i],
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
  it('draws the world it composed rather than answering beside it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')

    // The composer is folded away: the list of worlds is what the page opens
    // with, and building one by hand is what you come back for.
    await user.click(await screen.findByRole('button', { name: /compose a world of your own/i }))

    // Nothing switched off, so the drawing is still the world chosen above it.
    expect(await screen.findByText(/within reach in this world/i)).toBeInTheDocument()

    // Losing Site B alone is survivable: Key B's device is at Site A, so its
    // backup being unreachable does not take the key with it. The picture is
    // the answer, and it is the picture that changes.
    await user.click(screen.getByRole('button', { name: 'Site B', pressed: false }))
    expect(await screen.findByText(/a world you composed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Site B.*Not available/i })).toBeInTheDocument()

    // Site A as well, and there is neither a threshold nor a descriptor left.
    await user.click(screen.getByRole('button', { name: 'Site A', pressed: false }))
    expect(await screen.findAllByText(/unspendable/i)).not.toHaveLength(0)
  })
})

describe('an empty plan', () => {
  // A derived page given nothing is technically correct and completely
  // misleading, so every one of them has to say so rather than go quiet.
  const derived: [string, string][] = [
    ['#/findings', 'the silence below means nothing'],
    ['#/map', 'nothing to draw'],
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

describe('vendor data', () => {
  const file = (body: unknown) =>
    new File([JSON.stringify(body)], 'vendors.json', { type: 'application/json' })

  it('ships with none, and what a loaded file says is dated and disclaimed', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/file')
    // Empty on purpose: a built-in table of which signer has a secure element
    // is correct on the day it ships and quietly wrong a year later.
    expect(await screen.findByText(/none loaded, which is the default/i)).toBeInTheDocument()

    await user.upload(
      screen.getByLabelText(/choose a vendor data file/i),
      file({
        version: 1,
        asOf: '2026-08-01',
        source: 'My own notes',
        vendors: [
          {
            id: 'Vendor One',
            name: 'Vendor One',
            architecture: 'Own firmware',
            secureElement: true,
          },
        ],
      })
    )
    // One vendor, said as one vendor.
    expect(await screen.findByText(/^1 vendor$/)).toBeInTheDocument()

    // Beside the device it is a claim from a file, with the day it was true.
    goto('#/design/devices')
    expect(await screen.findByText(/from your vendor file, as of 2026-08-01/i)).toBeInTheDocument()
    expect(screen.getByText(/architecture: own firmware/i)).toBeInTheDocument()
    expect(screen.getByText(/not conclusions this program reached/i)).toBeInTheDocument()
  })

  it('refuses a file it cannot read rather than half-loading it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/file')
    await user.upload(
      await screen.findByLabelText(/choose a vendor data file/i),
      file({ version: 1 })
    )

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument()
    expect(screen.getByText(/none loaded, which is the default/i)).toBeInTheDocument()
  })
})

describe('a recovery time that is a floor', () => {
  it('names what is missing and offers the field that would fix it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    // Site A is on the route for both wallets, so forgetting how far away it is
    // is a gap the figure depends on. Site B is not, and the engine is right
    // not to call that a gap.
    goto('#/design/locations')
    await user.click(
      within(await screen.findByRole('list', { name: /^places$/i })).getByText('Site A')
    )
    await user.clear(screen.getByLabelText(/travel time/i))

    goto('#/overview')

    // Said out loud rather than in a tooltip, which is not a place a reader
    // finds anything and not a place a finger reaches at all.
    expect(await screen.findByText(/floors rather than estimates/i)).toBeInTheDocument()
    const gap = screen.getByText(/how far away site a is has not been recorded/i)
    expect(gap).toBeInTheDocument()

    await user.click(within(gap).getByRole('button', { name: /record it/i }))
    expect(await screen.findByRole('heading', { name: /^places$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Site A', level: 2 })).toBeInTheDocument()
  })
})

describe('the rules it applies', () => {
  it('opens a category and shows what each rule looks for', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/reasoning')

    // The page promises every rule, behind eight doors that have to look like
    // doors. Shut to begin with, because sixty four rules is not a page.
    const loss = await screen.findByRole('button', { name: /remove one thing/i })
    expect(loss).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/fire, flood, theft and eviction/i)).not.toBeInTheDocument()

    await user.click(loss)
    expect(loss).toHaveAttribute('aria-expanded', 'true')
    // What the rule looks for, and why, which is what makes disagreeing with
    // it a legitimate outcome of reading it.
    expect(
      screen.getByText(/one location lost and a wallet becomes unspendable/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/fire, flood, theft and eviction/i)).toBeInTheDocument()
  })
})

describe('narrowing the findings', () => {
  it('says it is narrowed, and offers the way back', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/findings')

    // The counts above the list are the controls, which is not something two
    // rows of numbers say on their own.
    expect(await screen.findByText(/narrow the list/i)).toBeInTheDocument()
    const critical = screen.getByRole('button', { name: /8 critical/ })
    expect(critical).toHaveAttribute('aria-pressed', 'false')

    await user.click(critical)
    expect(critical).toHaveAttribute('aria-pressed', 'true')
    // A filtered list that does not say so has quietly stopped being the list.
    expect(await screen.findByText(/showing 8 of 24/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show all of them/i }))
    expect(screen.queryByText(/showing 8 of 24/i)).not.toBeInTheDocument()
    expect(critical).toHaveAttribute('aria-pressed', 'false')
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

describe('removing a plan', () => {
  it('asks first, and undo brings it back', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/file')
    await user.click(await screen.findByRole('button', { name: /remove two of three/i }))
    expect(await screen.findByRole('dialog')).toHaveTextContent(/remove two of three/i)
    expect(useStore.getState().plans).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /remove it/i }))
    expect(useStore.getState().plans).toHaveLength(0)

    useStore.getState().undo()
    expect(useStore.getState().plans).toHaveLength(1)
  })
})

describe('a policy with a timelock', () => {
  it('is drawn, and a plain m-of-n is not', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, repaired'))

    goto('#/design/wallets')
    // The vault has an everyday path and an inheritance path that waits.
    expect(await screen.findByText(/when each way opens/i)).toBeInTheDocument()
    expect(screen.getByText(/after 180d/i)).toBeInTheDocument()

    // The phone wallet is one way to spend, available now. A picture of that
    // would be a picture of the number beside it. Taken from the list rather
    // than by name, because the step's own drawing has a box called Daily too.
    await user.click(within(screen.getByRole('list', { name: /^wallets$/i })).getByText('Daily'))
    expect(screen.queryByText(/when each way opens/i)).not.toBeInTheDocument()
  })
})

describe('a stored plan this build cannot read', () => {
  it('is set aside and reported, not silently thrown away', async () => {
    reset()
    // Something a previous build, or a text editor, left behind.
    window.localStorage.setItem(
      'outlive.diy/plan-file/v1',
      JSON.stringify({ schemaVersion: 1, plans: [{ id: 'x' }] })
    )
    render(<App />)

    expect(
      await screen.findByText(/something was stored here that this build cannot read/i)
    ).toBeInTheDocument()

    // Kept, under its own key, where the storage page lists it.
    expect(window.localStorage.getItem('outlive.diy/unreadable/v1')).toContain('schemaVersion')
    // And out of the way, so the first edit does not write over it.
    expect(window.localStorage.getItem('outlive.diy/plan-file/v1')).toBeNull()
  })

  it('says nothing when there is simply nothing stored', async () => {
    reset()
    render(<App />)
    await screen.findByRole('heading', { name: /design a bitcoin custody plan/i })
    expect(screen.queryByText(/cannot read/i)).not.toBeInTheDocument()
  })
})

describe('the diagram', () => {
  it('draws the chain from a wallet down to the place it rests on', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')

    // The whole dependency chain, as boxes rather than as a table.
    expect(await screen.findByRole('button', { name: /^Vault\b.*wallet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Key A.*key\./i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Site A.*place\./i })).toBeInTheDocument()
  })

  it('takes a place away and reports what stops working', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')
    // As it stands, everything is in reach.
    expect(await screen.findByText(/within reach in this world/i)).toBeInTheDocument()

    // Losing Site C breaks nothing, so it is behind the second filter rather
    // than in the list of what breaks.
    await user.click(screen.getByRole('button', { name: /^All \d+$/ }))
    await user.click(screen.getByRole('button', { name: /Site C is destroyed or emptied/ }))

    // And now one branch of it is not, named rather than only coloured.
    expect(await screen.findByText(/out of reach here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Site C.*Not available/i })).toBeInTheDocument()
  })

  it('carries every world the engine can build, with what each one breaks', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')

    // The stress test used to be a page of its own. It is the control for the
    // drawing, so it is beside the drawing, and each row says what it costs.
    const gone = await screen.findByRole('button', { name: /Site A is destroyed or emptied/ })
    expect(within(gone).getByText(/2 unspendable/)).toBeInTheDocument()
    // A verdict per wallet, named as well as coloured.
    expect(within(gone).getByText(/Vault: unspendable/)).toBeInTheDocument()
  })

  it('gives the drawing controls to move around in it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')

    expect(await screen.findByRole('button', { name: /zoom in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fit the whole plan/i })).toBeInTheDocument()
    // And the surface itself is reachable from the keyboard.
    expect(
      screen.getByRole('group', { name: /drag the background to move it/i })
    ).toBeInTheDocument()
  })

  it('moves a box within its column, and not out of it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')

    const box = (label: RegExp) => screen.getByRole('button', { name: label })
    const topOf = (label: RegExp) => Number.parseFloat((box(label) as HTMLElement).style.top || '0')
    const keyB = /^Key B.*key\./i
    const keyC = /^Key C.*key\./i

    // Two boxes in the keys column, in the order the layout argued for.
    const before = topOf(keyB)
    expect(before).toBeLessThan(topOf(keyC))
    const column = (box(keyB) as HTMLElement).style.left

    // Dragging is the usual way and is no way at all without a pointer.
    await user.click(box(keyB))
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')

    expect(topOf(keyB)).toBeGreaterThan(topOf(keyC))
    // Down the column it already belonged to. Across that boundary the box
    // would be claiming to be a different kind of thing.
    expect((box(keyB) as HTMLElement).style.left).toBe(column)

    // And there is a way back, which only appears once there is something to
    // go back from.
    await user.click(screen.getByRole('button', { name: /put the boxes back in order/i }))
    expect(topOf(keyB)).toBeLessThan(topOf(keyC))
    expect(
      screen.queryByRole('button', { name: /put the boxes back in order/i })
    ).not.toBeInTheDocument()
  })

  it('reads a wallet an intruder can spend as the failure, not as good news', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('One signer, one backup'))

    goto('#/map')
    await user.click(await screen.findByRole('button', { name: /is opened by someone else/i }))

    // The list inverts with the actor: what they hold, not what they missed.
    expect(await screen.findByText(/what they can reach/i)).toBeInTheDocument()
    // Said in the standing above the drawing and again beside the world in the
    // list, which is why this counts them rather than naming one.
    expect(screen.getAllByText(/they can spend it/i).length).toBeGreaterThan(0)
  })
})

describe('the purpose questions', () => {
  it('offer consequences rather than a number box', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/design/profile')

    // The answer says what it commits you to.
    expect(
      await screen.findByText(/every route has to be walkable this afternoon/i)
    ).toBeInTheDocument()
  })

  it('measure the answers against the plan underneath them', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/design/profile')

    expect(await screen.findByText(/what you said, against what you built/i)).toBeInTheDocument()
    // Measured from the plan, not asserted: this is the real slowest route.
    expect(screen.getByText(/the slowest recovery that still works/i)).toBeInTheDocument()
  })

  it('changes the measurement when the answer changes', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, repaired'))

    goto('#/design/profile')
    // A month is enough for this plan's slowest surviving route.
    expect(await screen.findByText(/the slowest recovery that still works/i)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /the same day/i }))

    // Same measurement, different verdict, and the finding appears with it.
    goto('#/findings')
    expect(await screen.findByText(/Recovering Vault takes/i)).toBeInTheDocument()
  })
})

describe('describing a plan', () => {
  it('reads back what a step told the analysis', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/design/locations')

    expect(await screen.findByText(/what this told the analysis/i)).toBeInTheDocument()
    // Two of the three sites share a disaster group, which is the whole point
    // of asking for one.
    expect(screen.getByText(/Site A and Site B fail together/i)).toBeInTheDocument()
  })

  it('offers the intervals that mean something instead of a number box', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/design/checks')

    // 365 gets typed because it is a year, not because a year was decided.
    const yearly = await screen.findByRole('button', { name: 'Once a year' })
    expect(yearly).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Every 3 months' }))
    expect(screen.getByRole('button', { name: 'Every 3 months' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    // And the exact number is still there, because sometimes it is 45 days.
    expect(screen.getByLabelText(/how often/i)).toHaveValue(90)
  })

  it('is one screen with a position in an order, not two screens', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/design/locations')

    // The step says where it is, why it is being asked, and where it goes next.
    expect(await screen.findByText(/step 2 of 7/i)).toBeInTheDocument()
    expect(screen.getByText(/two sites in one flood plain are one site/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^next/i }))
    expect(await screen.findByRole('heading', { name: /^people$/i })).toBeInTheDocument()

    // And the last step hands over to the findings rather than to nothing.
    goto('#/design/checks')
    await user.click(await screen.findByRole('button', { name: /read the findings/i }))
    expect(await screen.findByRole('heading', { name: /^findings$/i })).toBeInTheDocument()
  })
})

describe('a finding and its picture', () => {
  it('opens the map in the world the finding came out of', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/findings')
    // Every card renders its body so that printing gets the whole list, so the
    // link has to be taken from the one card rather than from the page.
    const title = await screen.findByText(/Losing Site A makes Vault and Daily unspendable/i)
    const card = title.closest('article')!
    await user.click(within(card).getByRole('button', { name: /draw this on the map/i }))

    // Not the default view of the map: the one where Site A is gone.
    expect(await screen.findByRole('heading', { name: /^map$/i })).toBeInTheDocument()
    expect(
      screen.getByText(/Site A is destroyed or emptied\. Can you still spend/i)
    ).toBeInTheDocument()
  })
})

describe('the repeated parts of an entity', () => {
  it('are rows that say what they are, shut, until you open one', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/design/keys')

    // The backup reads as a line, not as five fields.
    // Anchored, because the remove button beside it is "Remove Steel plate".
    const row = await screen.findByRole('button', { name: /^Steel plate/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(row).toHaveTextContent(/Site A/)

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Backup name')).toBeInTheDocument()
  })

  it('open a row that has just been added, because that is why you added it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/design/keys')
    await user.click(screen.getByRole('button', { name: /add backup/i }))

    const added = await screen.findByRole('button', { name: /^Backup 2/ })
    expect(added).toHaveAttribute('aria-expanded', 'true')
    // And it says immediately what is still missing from it.
    expect(added).toHaveTextContent(/no place recorded/)
    // The one that was already there stays shut.
    expect(screen.getByRole('button', { name: /^Steel plate/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('use the same pattern for the ways to spend a wallet', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, repaired'))

    goto('#/design/wallets')

    const everyday = await screen.findByRole('button', { name: /^Everyday/ })
    expect(everyday).toHaveAttribute('aria-expanded', 'false')
    expect(everyday).toHaveTextContent(/2 of 3/)
    expect(screen.getByRole('button', { name: /^Inheritance/ })).toHaveTextContent(
      /opens after 180 days/
    )
  })

  it('will not offer to remove the only way a wallet can be spent', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/design/wallets')
    const wallets = await screen.findByRole('list', { name: /^wallets$/i })
    await user.click(within(wallets).getByText('Daily'))

    // One path, and no way to delete it from here: a wallet with none is a
    // description of coins nobody can move.
    expect(screen.queryByRole('button', { name: /Remove Phone/i })).not.toBeInTheDocument()
  })
})

describe('the map, as one instrument', () => {
  it('answers about the box you clicked, without leaving the world you are in', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')
    await user.click(await screen.findByRole('button', { name: /^Site A.*place\./i }))

    // Still on the map, now with an answer about that one box.
    expect(screen.getByRole('heading', { name: /^map$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Site A', level: 3 })).toBeInTheDocument()
    expect(screen.getByText(/what is kept here/i)).toBeInTheDocument()
    // Including what the findings already said about it.
    expect(screen.getByText(/Site A alone is enough to spend Daily/i)).toBeInTheDocument()
  })

  it('takes that box away and redraws everything in the world without it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')
    await user.click(await screen.findByRole('button', { name: /^Site A.*place\./i }))
    await user.click(screen.getByRole('button', { name: /take it away/i }))

    // The lens moved to the scenario the engine already had for it.
    expect(
      await screen.findByText(/Site A is destroyed or emptied\. Can you still spend/i)
    ).toBeInTheDocument()
    // And the wallets are read in that world rather than in today's.
    expect(await screen.findAllByText(/unspendable/i)).not.toHaveLength(0)
    // The panel is still about Site A, now saying what this world did to it.
    expect(screen.getByText(/not available here/i)).toBeInTheDocument()
  })

  it('keeps editing as a deliberate act rather than the price of looking', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')
    await user.click(await screen.findByRole('button', { name: /^Key A.*key\./i }))
    // Clicking the node did not navigate anywhere.
    expect(screen.getByRole('heading', { name: /^map$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(await screen.findByRole('heading', { name: /^keys$/i })).toBeInTheDocument()
  })
})

describe('what a page shows at rest', () => {
  it('lists every way the plan fails before it shows any one of them', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/recovery')

    // Fourteen routes, each one line: the verdict and how long it takes.
    const row = await screen.findByRole('button', { name: /^Site B is destroyed or emptied/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(row).toHaveTextContent(/same day, no travel/)

    // The steps are there when you ask for them. Scoped to the row, because
    // every route keeps its body in the document so that printing gets them all.
    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    const body = within(row.closest('li') as HTMLElement)
    expect(body.getByText(/get the wallet configuration first/i)).toBeInTheDocument()
    expect(body.getByText(/collect from site a/i)).toBeInTheDocument()
  })

  it('says a phase-wide instruction once rather than once per key', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/runbook')

    // Three keys generated the same way: one paragraph, three ticks. Repeating
    // it three times is how a reader learns to skip the paragraphs.
    expect(await screen.findByText(/Generate Key A on Signer A/)).toBeInTheDocument()
    expect(screen.getByText(/Generate Key C on Signer C/)).toBeInTheDocument()
    expect(screen.getAllByText(/generate it on the device itself, offline/i)).toHaveLength(1)
  })

  it('folds the arithmetic under the map away rather than stacking it', async () => {
    reset()
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByText('Two of three, three sites'))

    goto('#/map')

    const table = await screen.findByRole('button', { name: /the same thing, as numbers/i })
    expect(table).toHaveAttribute('aria-expanded', 'false')
    await user.click(table)
    expect(screen.getByText(/what each place is enough for/i)).toBeInTheDocument()
  })
})
