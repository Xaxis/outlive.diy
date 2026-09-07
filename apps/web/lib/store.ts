'use client'

/**
 * Application state.
 *
 * One store holds every plan open in the session: the one the user runs, and
 * any drafts beside it. Drafts are first-class rather than a mode, because
 * comparing candidates is the main thing a planner is for and a tool that makes
 * you overwrite the current plan to try an idea is a tool you stop trying ideas
 * in.
 *
 * Undo is a stack of whole-plan snapshots. Plans are small and structurally
 * shared, so the simple thing is also the cheap thing, and it means undo can
 * never disagree with what an edit actually did.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  createDevice,
  createKey,
  createLocation,
  createPerson,
  createPlan,
  createSpendPath,
  createVerification,
  createWallet,
  exampleById,
  inspectDeep,
  letterLabel,
  numberLabel,
  parsePlanFile,
  today,
  type Device,
  type Id,
  type Key,
  type Location,
  type Person,
  type Plan,
  type Ref,
  type Verification,
  type VendorData,
  type Wallet,
} from '@outlive/core'
import {
  clearStoredFile,
  defaultPreferences,
  eraseEverything,
  makeFile,
  readPreferences,
  readStoredFile,
  saveToDisk,
  suggestedFilename,
  writePreferences,
  writeStoredFile,
  type Persistence,
  type Preferences,
} from './storage.ts'

export type EntityKind = 'location' | 'person' | 'device' | 'key' | 'wallet' | 'verification'

export interface Toast {
  id: number
  tone: 'ok' | 'warn' | 'error'
  message: string
  detail?: string
}

interface Snapshot {
  plans: Plan[]
  activeId: Id
}

interface StoreState {
  /** False until local storage has been read, which cannot happen during render. */
  ready: boolean
  plans: Plan[]
  activeId: Id
  /** The plan the current one is being compared against, if any. */
  compareId: Id | null
  selection: Ref | null
  preferences: Preferences
  vendorData: VendorData | null
  past: Snapshot[]
  future: Snapshot[]
  toast: Toast | null

  hydrate: () => void
  edit: (recipe: (plan: Plan) => void, options?: { silent?: boolean }) => void
  undo: () => void
  redo: () => void

  setActive: (id: Id) => void
  setCompare: (id: Id | null) => void
  select: (ref: Ref | null) => void

  startPlan: (name?: string) => void
  openExample: (id: string) => void
  forkAsDraft: (id: Id) => void
  renamePlan: (id: Id, name: string) => void
  removePlan: (id: Id) => void

  addEntity: (kind: EntityKind) => Id | null
  removeEntity: (kind: EntityKind, id: Id) => void

  importFile: (text: string) => void
  save: () => Promise<void>
  setPersistence: (mode: Persistence) => void
  setTheme: (theme: Preferences['theme']) => void
  acknowledgeScope: () => void
  eraseLocal: () => void
  setVendorData: (data: VendorData | null) => void
  notify: (toast: Omit<Toast, 'id'>) => void
  dismissToast: () => void
}

const HISTORY_LIMIT = 60

function snapshot(state: StoreState): Snapshot {
  return { plans: state.plans, activeId: state.activeId }
}

function persist(state: StoreState): void {
  if (state.preferences.persistence !== 'local') return
  writeStoredFile(makeFile(state.plans, state.activeId))
}

export const useStore = create<StoreState>()(
  immer((set, get) => ({
    ready: false,
    plans: [],
    activeId: '',
    compareId: null,
    selection: null,
    preferences: defaultPreferences,
    vendorData: null,
    past: [],
    future: [],
    toast: null,

    hydrate: () => {
      const preferences = readPreferences()
      const stored = preferences.persistence === 'local' ? readStoredFile() : null
      set((state) => {
        state.preferences = preferences
        state.ready = true
        if (stored && stored.plans.length > 0) {
          state.plans = stored.plans
          state.activeId = stored.activePlanId ?? stored.plans[0].id
        }
      })
    },

    edit: (recipe, options = {}) => {
      set((state) => {
        const plan = state.plans.find((entry) => entry.id === state.activeId)
        if (!plan) return
        if (!options.silent) {
          state.past.push(snapshot(state as StoreState))
          if (state.past.length > HISTORY_LIMIT) state.past.shift()
          state.future = []
        }
        recipe(plan)
        plan.updatedAt = today()
      })
      persist(get())
    },

    undo: () => {
      set((state) => {
        const previous = state.past.pop()
        if (!previous) return
        state.future.push(snapshot(state as StoreState))
        state.plans = previous.plans
        state.activeId = previous.activeId
      })
      persist(get())
    },

    redo: () => {
      set((state) => {
        const next = state.future.pop()
        if (!next) return
        state.past.push(snapshot(state as StoreState))
        state.plans = next.plans
        state.activeId = next.activeId
      })
      persist(get())
    },

    setActive: (id) =>
      set((state) => {
        state.activeId = id
        state.selection = null
        if (state.compareId === id) state.compareId = null
      }),

    setCompare: (id) =>
      set((state) => {
        state.compareId = id
      }),

    select: (ref) =>
      set((state) => {
        state.selection = ref
      }),

    startPlan: (name) => {
      const plan = createPlan({ name: name ?? 'My plan' })
      set((state) => {
        state.past.push(snapshot(state as StoreState))
        state.plans.push(plan)
        state.activeId = plan.id
        state.selection = null
      })
      persist(get())
    },

    openExample: (exampleId) => {
      const example = exampleById(exampleId)
      if (!example) return
      // A fresh id every time, so opening the same example twice gives two
      // plans rather than silently replacing the first.
      const plan = { ...example, id: `${example.id}-${Math.random().toString(36).slice(2, 8)}` }
      set((state) => {
        state.past.push(snapshot(state as StoreState))
        state.plans.push(plan)
        state.activeId = plan.id
        state.selection = null
      })
      persist(get())
    },

    forkAsDraft: (id) => {
      const source = get().plans.find((plan) => plan.id === id)
      if (!source) return
      const draft: Plan = {
        ...structuredClone(source),
        id: `${source.id}-draft-${Math.random().toString(36).slice(2, 8)}`,
        name: `${source.name} (draft)`,
        kind: 'draft',
        createdAt: today(),
        updatedAt: today(),
      }
      set((state) => {
        state.past.push(snapshot(state as StoreState))
        state.plans.push(draft)
        state.compareId = source.id
        state.activeId = draft.id
      })
      persist(get())
      get().notify({
        tone: 'ok',
        message: 'Draft created',
        detail:
          'Change it freely. The comparison view shows which findings your changes close and which they open.',
      })
    },

    renamePlan: (id, name) => {
      set((state) => {
        const plan = state.plans.find((entry) => entry.id === id)
        if (plan) plan.name = name
      })
      persist(get())
    },

    removePlan: (id) => {
      set((state) => {
        state.past.push(snapshot(state as StoreState))
        state.plans = state.plans.filter((plan) => plan.id !== id)
        if (state.activeId === id) state.activeId = state.plans[0]?.id ?? ''
        if (state.compareId === id) state.compareId = null
      })
      persist(get())
    },

    addEntity: (kind) => {
      const plan = get().plans.find((entry) => entry.id === get().activeId)
      if (!plan) return null
      let created: Id | null = null
      get().edit((draft) => {
        switch (kind) {
          case 'location': {
            const location = createLocation({
              label: letterLabel(
                'Site',
                draft.locations.map((entry) => entry.label)
              ),
              kind: draft.locations.length === 0 ? 'home' : 'other',
              travelMinutes: draft.locations.length === 0 ? 0 : null,
            })
            draft.locations.push(location)
            created = location.id
            break
          }
          case 'person': {
            const person = createPerson({
              label: numberLabel(
                'Successor',
                draft.people.map((entry) => entry.label)
              ),
            })
            draft.people.push(person)
            created = person.id
            break
          }
          case 'device': {
            const device = createDevice({
              label: letterLabel(
                'Signer',
                draft.devices.map((entry) => entry.label)
              ),
            })
            draft.devices.push(device)
            created = device.id
            break
          }
          case 'key': {
            const key = createKey({
              label: letterLabel(
                'Key',
                draft.keys.map((entry) => entry.label)
              ),
            })
            draft.keys.push(key)
            created = key.id
            break
          }
          case 'wallet': {
            const wallet = createWallet({
              label: draft.wallets.length === 0 ? 'Vault' : `Wallet ${draft.wallets.length + 1}`,
              paths: [createSpendPath({ threshold: 1, keyIds: [] })],
            })
            draft.wallets.push(wallet)
            created = wallet.id
            break
          }
          case 'verification': {
            const verification = createVerification({ subject: { type: 'plan', id: draft.id } })
            draft.verifications.push(verification)
            created = verification.id
            break
          }
        }
      })
      return created
    },

    removeEntity: (kind, id) => {
      get().edit((draft) => {
        switch (kind) {
          case 'location':
            draft.locations = draft.locations.filter((entry) => entry.id !== id)
            for (const location of draft.locations) {
              if (location.custodianId === id) location.custodianId = null
            }
            for (const device of draft.devices) {
              if (device.pin.locationId === id) device.pin.locationId = null
            }
            for (const key of draft.keys) {
              if (key.deviceLocationId === id) key.deviceLocationId = null
              for (const backup of key.backups) {
                if (backup.locationId === id) backup.locationId = null
              }
              key.passphrase.locationIds = key.passphrase.locationIds.filter(
                (entry) => entry !== id
              )
            }
            for (const wallet of draft.wallets) {
              for (const backup of wallet.configBackups) {
                if (backup.locationId === id) backup.locationId = null
              }
            }
            break
          case 'person':
            draft.people = draft.people.filter((entry) => entry.id !== id)
            for (const location of draft.locations) {
              location.access = location.access.filter((entry) => entry.personId !== id)
              if (location.custodianId === id) location.custodianId = null
            }
            for (const device of draft.devices) {
              device.pin.knownBy = device.pin.knownBy.filter((entry) => entry !== id)
            }
            for (const key of draft.keys) {
              if (key.heldBy === id) key.heldBy = null
              key.passphrase.knownBy = key.passphrase.knownBy.filter((entry) => entry !== id)
            }
            break
          case 'device':
            draft.devices = draft.devices.filter((entry) => entry.id !== id)
            for (const key of draft.keys) {
              if (key.deviceId === id) key.deviceId = null
            }
            break
          case 'key':
            draft.keys = draft.keys.filter((entry) => entry.id !== id)
            for (const wallet of draft.wallets) {
              for (const path of wallet.paths) {
                path.keyIds = path.keyIds.filter((entry) => entry !== id)
              }
            }
            break
          case 'wallet':
            draft.wallets = draft.wallets.filter((entry) => entry.id !== id)
            break
          case 'verification':
            draft.verifications = draft.verifications.filter((entry) => entry.id !== id)
            break
        }
        draft.verifications = draft.verifications.filter(
          (verification) => verification.subject.id !== id
        )
      })
      set((state) => {
        if (state.selection?.id === id) state.selection = null
      })
    },

    importFile: (text) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        get().notify({
          tone: 'error',
          message: 'That file is not readable',
          detail: 'It is not valid JSON. If you edited it by hand, something is unbalanced.',
        })
        return
      }

      // A file carrying secrets is refused at the door rather than loaded and
      // then quietly written back to local storage.
      const hits = inspectDeep(parsed).filter((hit) => hit.strength === 'refuse')
      if (hits.length > 0) {
        get().notify({
          tone: 'error',
          message: 'That file contains key material',
          detail: `${hits[0].field}: ${hits[0].found}. This app will not hold it, not even long enough to show it to you. Remove it from the file and try again.`,
        })
        return
      }

      const result = parsePlanFile(parsed)
      if (!result.ok) {
        get().notify({
          tone: 'error',
          message: 'That file is not a plan this build can read',
          detail: result.problems.slice(0, 3).join(' · '),
        })
        return
      }

      set((state) => {
        state.past.push(snapshot(state as StoreState))
        state.plans = result.value.plans
        state.activeId = result.value.activePlanId ?? result.value.plans[0].id
        state.compareId = null
        state.selection = null
      })
      persist(get())
      get().notify({
        tone: 'ok',
        message: `Opened ${result.value.plans.length === 1 ? 'the plan' : `${result.value.plans.length} plans`}`,
        detail: `Saved ${result.value.savedAt} by ${result.value.generator}.`,
      })
    },

    save: async () => {
      const state = get()
      const active = state.plans.find((plan) => plan.id === state.activeId)
      const outcome = await saveToDisk(
        makeFile(state.plans, state.activeId),
        suggestedFilename(active?.name ?? 'plan')
      )
      if (outcome === 'saved') {
        get().notify({
          tone: 'ok',
          message: 'Saved',
          detail: 'The file is yours. Nothing left this browser.',
        })
      }
    },

    setPersistence: (mode) => {
      set((state) => {
        state.preferences.persistence = mode
      })
      const preferences = get().preferences
      writePreferences(preferences)
      if (mode === 'memory') {
        clearStoredFile()
        get().notify({
          tone: 'ok',
          message: 'Nothing is being written to this browser',
          detail: 'Save to a file before you close the tab, or the plan is gone.',
        })
      } else {
        persist(get())
      }
    },

    setTheme: (theme) => {
      set((state) => {
        state.preferences.theme = theme
      })
      writePreferences(get().preferences)
    },

    acknowledgeScope: () => {
      set((state) => {
        state.preferences.scopeAcknowledged = true
      })
      writePreferences(get().preferences)
    },

    eraseLocal: () => {
      eraseEverything()
      set((state) => {
        state.plans = []
        state.activeId = ''
        state.compareId = null
        state.selection = null
        state.past = []
        state.future = []
        state.preferences = defaultPreferences
        state.vendorData = null
      })
    },

    setVendorData: (data) =>
      set((state) => {
        state.vendorData = data
      }),

    notify: (toast) =>
      set((state) => {
        state.toast = { ...toast, id: Date.now() }
      }),

    dismissToast: () =>
      set((state) => {
        state.toast = null
      }),
  }))
)

// --- selectors --------------------------------------------------------------

export function useActivePlan(): Plan | null {
  return useStore((state) => state.plans.find((plan) => plan.id === state.activeId) ?? null)
}

export function useComparePlan(): Plan | null {
  return useStore((state) =>
    state.compareId ? (state.plans.find((plan) => plan.id === state.compareId) ?? null) : null
  )
}

export type Entity = Location | Person | Device | Key | Wallet | Verification

export function entitiesOf(plan: Plan, kind: EntityKind): Entity[] {
  switch (kind) {
    case 'location':
      return plan.locations
    case 'person':
      return plan.people
    case 'device':
      return plan.devices
    case 'key':
      return plan.keys
    case 'wallet':
      return plan.wallets
    case 'verification':
      return plan.verifications
  }
}
