import { beforeEach, describe, expect, it } from 'vitest'
import { baseWorld, evaluateWallet } from '@outlive/core'
import { useStore } from './store.ts'

const plan = () => {
  const state = useStore.getState()
  return state.plans.find((entry) => entry.id === state.activeId)!
}

beforeEach(() => {
  useStore.setState({ ready: false, plans: [], activeId: '', past: [], future: [], toast: null })
  useStore.getState().hydrate()
  useStore.getState().startPlan()
})

describe('adding things one step at a time', () => {
  it('puts a new key on the device nothing signs with yet', () => {
    const store = useStore.getState()
    store.addEntity('device')
    store.addEntity('device')
    store.addEntity('key')
    store.addEntity('key')
    const [first, second] = plan().devices
    expect(plan().keys.map((key) => key.deviceId)).toEqual([first.id, second.id])
    // With every device taken, the next key has none rather than sharing one.
    store.addEntity('key')
    expect(plan().keys[2].deviceId).toBeNull()
  })

  it('spends a new wallet with the keys already described, a majority of them', () => {
    const store = useStore.getState()
    for (let n = 0; n < 3; n += 1) store.addEntity('key')
    store.addEntity('wallet')
    const [path] = plan().wallets[0].paths
    expect(path.keyIds).toHaveLength(3)
    expect(path.threshold).toBe(2)
  })

  it('does not turn walking the steps in order into a wallet nobody can spend', () => {
    const store = useStore.getState()
    for (const kind of ['location', 'person', 'device', 'key', 'wallet'] as const)
      store.addEntity(kind)
    const current = plan()
    expect(current.wallets[0].paths[0].keyIds).toEqual([current.keys[0].id])
    // Spendable today: the one question the whole analysis is asked in.
    expect(evaluateWallet(current, current.wallets[0], baseWorld(current)).spendable).toBe(true)
  })
})
