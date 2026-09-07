/**
 * Optional vendor knowledge, kept deliberately outside the engine.
 *
 * Device-specific facts rot. A table of which signer has a secure element and
 * which firmware version fixed which advisory is correct on the day it is
 * written and quietly wrong a year later, and a planning tool that presents
 * stale facts with the same confidence as structural reasoning is worse than
 * one that presents none.
 *
 * So none of it lives in the analysis. This module reads a dated file the user
 * supplies and produces *notes*, which the interface shows next to the date
 * they were true. Every analysis in this engine runs identically with the file
 * absent, which is the default.
 */

import type { IsoDate, Plan } from '../model/types.ts'

export const VENDOR_DATA_VERSION = 1

export interface VendorAdvisory {
  id: string
  date: IsoDate
  summary: string
  /** Free text: the user's own file, the user's own words. */
  affects: string
}

export interface VendorEntry {
  /** Matched against Device.vendor, case-insensitively. */
  id: string
  name: string
  /** Silicon or firmware lineage, for correlated-failure grouping. */
  architecture?: string
  secureElement?: boolean
  airGapCapable?: boolean
  storesWalletConfig?: boolean
  notes?: string
  advisories?: VendorAdvisory[]
}

export interface VendorData {
  version: number
  /** The day the file's author last checked it. Shown wherever it is used. */
  asOf: IsoDate
  /** Where the author got it. Free text. */
  source: string
  vendors: VendorEntry[]
}

/**
 * The shipped default is empty on purpose.
 *
 * Shipping a populated table would make this build the authority on facts it
 * cannot keep current. The format is documented, the importer is one click, and
 * an empty file is an honest statement that this program knows nothing about
 * your hardware.
 */
export const EMPTY_VENDOR_DATA: VendorData = {
  version: VENDOR_DATA_VERSION,
  asOf: '1970-01-01',
  source: 'No vendor data loaded.',
  vendors: [],
}

export interface VendorNote {
  deviceId: string
  vendor: string
  /** What the file says, stated as the file's claim rather than as a fact. */
  claim: string
  asOf: IsoDate
}

export function parseVendorData(
  input: unknown
): { ok: true; value: VendorData } | { ok: false; problems: string[] } {
  const problems: string[] = []
  if (typeof input !== 'object' || input === null)
    return { ok: false, problems: ['Not an object.'] }
  const data = input as Partial<VendorData>
  if (data.version !== VENDOR_DATA_VERSION) {
    problems.push(`Expected version ${VENDOR_DATA_VERSION}, found ${String(data.version)}.`)
  }
  if (typeof data.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.asOf)) {
    problems.push(
      'asOf must be a date in YYYY-MM-DD form. A file with no date cannot be trusted to be current.'
    )
  }
  if (!Array.isArray(data.vendors)) problems.push('vendors must be a list.')
  if (problems.length > 0) return { ok: false, problems }
  return {
    ok: true,
    value: {
      version: VENDOR_DATA_VERSION,
      asOf: data.asOf as IsoDate,
      source: typeof data.source === 'string' ? data.source : 'Unstated.',
      vendors: (data.vendors as VendorEntry[]).filter(
        (entry) => typeof entry?.id === 'string' && typeof entry?.name === 'string'
      ),
    },
  }
}

export function lookupVendor(data: VendorData, vendor: string | null): VendorEntry | null {
  if (!vendor) return null
  const needle = vendor.trim().toLowerCase()
  return data.vendors.find((entry) => entry.id.toLowerCase() === needle) ?? null
}

/**
 * Notes for the devices in a plan. Never findings: this file is somebody's
 * research, and the engine does not adopt it as its own reasoning.
 */
export function vendorNotes(plan: Plan, data: VendorData): VendorNote[] {
  const notes: VendorNote[] = []
  for (const device of plan.devices) {
    const entry = lookupVendor(data, device.vendor)
    if (!entry) continue
    const claims: string[] = []
    if (entry.architecture && entry.architecture !== device.architecture) {
      claims.push(`architecture recorded as "${entry.architecture}"`)
    }
    if (entry.secureElement !== undefined) {
      claims.push(entry.secureElement ? 'has a secure element' : 'has no secure element')
    }
    if (entry.airGapCapable !== undefined && entry.airGapCapable !== device.airGapped) {
      claims.push(entry.airGapCapable ? 'can be run air-gapped' : 'cannot be run air-gapped')
    }
    if (
      entry.storesWalletConfig !== undefined &&
      entry.storesWalletConfig !== device.storesWalletConfig
    ) {
      claims.push(
        entry.storesWalletConfig
          ? 'stores the multisig wallet configuration'
          : 'does not store the multisig wallet configuration'
      )
    }
    for (const advisory of entry.advisories ?? []) {
      claims.push(`advisory ${advisory.id} (${advisory.date}): ${advisory.summary}`)
    }
    if (entry.notes) claims.push(entry.notes)
    for (const claim of claims) {
      notes.push({ deviceId: device.id, vendor: entry.name, claim, asOf: data.asOf })
    }
  }
  return notes
}

/** How stale the file is, in days, for the interface to show plainly. */
export function vendorDataAgeDays(data: VendorData, today: IsoDate): number {
  const then = Date.parse(`${data.asOf}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(then) || Number.isNaN(now)) return 0
  return Math.max(0, Math.round((now - then) / 86_400_000))
}
