import type { DeviceKind } from '@outlive/core'

/**
 * Makers and models to pick from, so nobody types "Trezor" three ways.
 *
 * Names and kinds only, and that is the line. `vendors/` is empty on purpose
 * because device facts rot: which chip, which advisory, which firmware is
 * trusted this year. None of that is here. What is here is what a device is
 * called and what sort of thing it is, which does not change after it ships,
 * and the one behavioural fact that decides a field in the model: a device
 * that can only ever be used air-gapped is marked so, because it has no other
 * way to be used. Everything picked from here can be typed over, and anything
 * not listed can be typed from scratch.
 *
 * The analysis reads none of it. Two keys behind one maker are one maker
 * whether the name came from this list or from the keyboard.
 */

export interface CatalogModel {
  name: string
  kind: DeviceKind
  /** Cannot be used any other way. Not "can be used air-gapped". */
  airGapOnly?: boolean
}

export interface CatalogMaker {
  name: string
  models: CatalogModel[]
}

const hw = (name: string, airGapOnly = false): CatalogModel => ({
  name,
  kind: airGapOnly ? 'air-gapped-signer' : 'hardware-signer',
  airGapOnly: airGapOnly || undefined,
})

export const DEVICE_CATALOG: CatalogMaker[] = [
  { name: 'Coinkite', models: [hw('Coldcard Mk4'), hw('Coldcard Q')] },
  {
    name: 'Trezor',
    models: [hw('Model One'), hw('Model T'), hw('Safe 3'), hw('Safe 5')],
  },
  { name: 'Ledger', models: [hw('Nano S Plus'), hw('Nano X'), hw('Stax'), hw('Flex')] },
  { name: 'BitBox', models: [hw('BitBox02')] },
  { name: 'Blockstream', models: [hw('Jade'), hw('Jade Plus')] },
  { name: 'Foundation', models: [hw('Passport', true), hw('Passport Prime', true)] },
  { name: 'Keystone', models: [hw('Keystone 3 Pro', true)] },
  { name: 'NGRAVE', models: [hw('ZERO', true)] },
  { name: 'SeedSigner', models: [hw('SeedSigner', true)] },
  { name: 'Krux', models: [hw('Krux', true)] },
  { name: 'Specter', models: [hw('Specter DIY', true)] },
  { name: 'OneKey', models: [hw('Classic 1S'), hw('Pro')] },
  { name: 'Cypherock', models: [hw('X1')] },
  {
    name: 'Sparrow',
    models: [{ name: 'Sparrow Wallet', kind: 'desktop-wallet' }],
  },
  { name: 'Electrum', models: [{ name: 'Electrum', kind: 'desktop-wallet' }] },
  {
    name: 'Nunchuk',
    models: [
      { name: 'Nunchuk app', kind: 'mobile-wallet' },
      { name: 'Assisted key', kind: 'service-cosigner' },
    ],
  },
  { name: 'BlueWallet', models: [{ name: 'BlueWallet', kind: 'mobile-wallet' }] },
  { name: 'Unchained', models: [{ name: 'Unchained key', kind: 'service-cosigner' }] },
  { name: 'Casa', models: [{ name: 'Casa recovery key', kind: 'service-cosigner' }] },
]

export function makerNamed(name: string | null): CatalogMaker | null {
  if (!name) return null
  const wanted = name.trim().toLowerCase()
  return DEVICE_CATALOG.find((maker) => maker.name.toLowerCase() === wanted) ?? null
}

export function modelNamed(maker: string | null, model: string | null): CatalogModel | null {
  if (!model) return null
  const wanted = model.trim().toLowerCase()
  return makerNamed(maker)?.models.find((entry) => entry.name.toLowerCase() === wanted) ?? null
}
