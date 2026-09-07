/**
 * Optional vendor knowledge, kept deliberately outside the engine.
 *
 * Device-specific facts rot. A table of which signer has a secure element and
 * which firmware version fixed which advisory is correct on the day it is
 * written and quietly wrong a year later, and a planning tool that presents
 * stale facts with the same confidence as structural reasoning is worse than
 * one that presents none.
 *
 * So none of it lives in the analysis. This module only validates a dated file
 * the user supplies and looks entries up in it; the interface shows what it
 * says beside the date it was said, captioned as a claim from that file rather
 * than a conclusion this program reached. Every analysis in this engine runs
 * identically with the file absent, which is the default.
 */

import type { IsoDate } from '../model/types.ts'

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

/** How stale the file is, in days, for the interface to show plainly. */
export function vendorDataAgeDays(data: VendorData, today: IsoDate): number {
  const then = Date.parse(`${data.asOf}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(then) || Number.isNaN(now)) return 0
  return Math.max(0, Math.round((now - then) / 86_400_000))
}
