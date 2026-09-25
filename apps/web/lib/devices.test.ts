import { describe, expect, it } from 'vitest'
import { createDevice } from '@outlive/core'
import {
  describeDevice,
  deviceChoiceLabel,
  isPlaceholderName,
  nameFromWhatItIs,
} from './devices.ts'

const coldcard = (label: string) =>
  createDevice({ label, vendor: 'Coinkite', model: 'Coldcard Q', kind: 'hardware-signer' })

describe('naming a device by what it is', () => {
  it('says maker and model, or maker and kind, or kind', () => {
    expect(describeDevice(coldcard('x'))).toBe('Coinkite Coldcard Q')
    expect(describeDevice({ vendor: 'Trezor', model: null, kind: 'hardware-signer' })).toBe(
      'Trezor hardware signer'
    )
    expect(describeDevice({ vendor: null, model: null, kind: 'mobile-wallet' })).toBe(
      'Phone wallet'
    )
    expect(
      describeDevice({ vendor: 'Sparrow', model: 'Sparrow Wallet', kind: 'desktop-wallet' })
    ).toBe('Sparrow Wallet')
  })

  it('knows the names it made up from the ones a reader chose', () => {
    expect(isPlaceholderName('Signer A')).toBe(true)
    expect(isPlaceholderName('')).toBe(true)
    expect(isPlaceholderName("Grandad's Coldcard")).toBe(false)
  })

  it('numbers the second of two identical devices', () => {
    const first = coldcard('Coinkite Coldcard Q')
    const second = coldcard('Signer B')
    expect(nameFromWhatItIs(second, [first, second])).toBe('Coinkite Coldcard Q 2')
    expect(nameFromWhatItIs(first, [first, second])).toBe('Coinkite Coldcard Q')
  })

  it('offers a device on a key by what it is, with the reader’s own name when there is one', () => {
    const plain = coldcard('Signer A')
    const named = coldcard('Travel signer')
    const phone = createDevice({ label: 'Signer C', kind: 'mobile-wallet' })
    expect(deviceChoiceLabel(phone, [plain, named, phone])).toBe('Signer C · phone wallet')
    expect(deviceChoiceLabel(named, [plain, named, phone])).toBe(
      'Travel signer · Coinkite Coldcard Q'
    )
    // Two of the same thing and one has no name: the placeholder tells them apart.
    expect(deviceChoiceLabel(plain, [plain, named, phone])).toBe('Coinkite Coldcard Q · Signer A')
  })
})
