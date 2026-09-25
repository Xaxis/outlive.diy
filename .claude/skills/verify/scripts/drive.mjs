#!/usr/bin/env node
/**
 * Drive outlive.diy in a real browser and report what happened.
 *
 * Playwright is deliberately not a dependency of this repository (it ships a
 * browser, and this project's claim is that it ships almost nothing), so it is
 * installed outside the checkout and found through $PW:
 *
 *   PW=/tmp/outlive-pw; mkdir -p $PW && (cd $PW && npm i playwright >/dev/null && npx playwright install chromium)
 *
 * Usage:
 *   PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs \
 *     --base http://localhost:4732 [--example "Two of three, three sites"] \
 *     [--path /app/#/map] [--do "await p.getByRole('button',{name:/Site A/}).first().click()"] \
 *     [--print "await p.locator('h1').first().innerText()"] [--shot /tmp/out.png] [--width 1440]
 *
 * It clears storage, optionally opens a worked example from the landing page,
 * goes to --path, runs --do, prints the value of --print, saves --shot, and
 * always reports console errors, page errors and any request that left the
 * origin. Exit code 1 if a page error or an unexpected outside request
 * happened; a request to api.anthropic.com is expected only when --do asks
 * Claude, so it is reported, not failed.
 */
import { createRequire } from 'node:module'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]])
    return pairs
  }, [])
)
const pw = process.env.PW
if (!pw) {
  console.error('Set PW to a directory with playwright installed; see the header of this file.')
  process.exit(2)
}
const { chromium } = createRequire(`${pw}/`)('playwright')
const base = (args.base ?? 'http://localhost:4732').replace(/\/$/, '')
const origin = new URL(base).origin

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: Number(args.width ?? 1440), height: 1000 },
})
const p = page
const outside = []
const errors = []
page.on('request', (request) => {
  const url = new URL(request.url())
  if (url.origin !== origin && url.protocol.startsWith('http'))
    outside.push(`${request.method()} ${url.host}${url.pathname}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error' && !/api\.anthropic\.com|401/.test(message.text()))
    errors.push(`console: ${message.text().slice(0, 200)}`)
})

await page.goto(`${base}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(800)
if (args.example) {
  await page.getByRole('button', { name: args.example }).first().click()
  await page.waitForURL(/\/app\//)
  await page.waitForTimeout(800)
}
if (args.path) {
  await page.goto(`${base}${args.path}`)
  await page.waitForTimeout(1000)
}
if (args.do) {
  await new Function('p', `return (async () => { ${args.do} })()`)(p)
  await page.waitForTimeout(500)
}
if (args.print)
  console.log('print:', await new Function('p', `return (async () => ${args.print})()`)(p))
if (args.shot) await page.screenshot({ path: args.shot, fullPage: true })
console.log('url:', page.url())
console.log('outside requests:', JSON.stringify(outside))
console.log('errors:', JSON.stringify(errors))
await browser.close()
const unexpected = outside.filter((entry) => !entry.includes('api.anthropic.com'))
process.exit(errors.some((entry) => entry.startsWith('pageerror')) || unexpected.length ? 1 : 0)
