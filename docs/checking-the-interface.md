# Checking the interface

The test suites cover behaviour. They cannot tell you that a form field is a
thousand pixels wide, that the top bar drops the Save button off a phone, or
that a printed page wastes half a sheet. Those need a browser and an eye, and
they were all found that way.

Playwright is deliberately not a dependency of this repository: it pulls a
browser binary, and this is a project whose whole claim is that it ships almost
nothing. Install it somewhere outside the checkout when you need it.

```bash
make build
npx serve apps/web/out -l 4321     # or: python3 -m http.server 4321 --directory apps/web/out

mkdir -p /tmp/outlive-shots && cd /tmp/outlive-shots
npm init -y && npm i playwright @axe-core/playwright
npx playwright install chromium
```

## What to look at

**Every view, both themes, two widths.** Desktop at 1440 and a phone at 390.
The views are the fragments listed in `apps/web/lib/router.ts`.

**A plan that describes nothing.** Every derived screen has to say so rather
than go quiet, and there is a test for each, but the empty states are also the
first thing a new user sees.

**The printed documents.** Render the findings, the runbook, the recovery routes
and the successor letter to PDF and read them. They are meant to be filed on
paper next to the backups, and paper does not scroll.

**Click every sidebar link and measure where the heading lands.** Not a
screenshot: the numbers. Every view should put its heading at the same x and the
same y with the page scrolled to the top, and if one of them does not, something
is centring itself or stealing the scroll position. This found both: twelve
views centred at four different widths, and a focus call that scrolled the
sticky header over the section label on every navigation.

```js
for (const label of links) {
  await page.getByRole('link', { name: label }).click()
  const box = await page.locator('main h1').first().boundingBox()
  console.log(label, box.x, box.y, await page.evaluate(() => window.scrollY))
}
```

**Open the plan menu on every screen size.** Overlays are where stacking order
goes wrong, and it only goes wrong where two of them meet.

**The network tab.** Load the app, use it, and confirm nothing is requested
after the initial load. That check takes ten seconds and is worth more than any
of the above. A Playwright run can assert it by listening on `request` and
failing on any URL that is not same-origin.

## Accessibility

Run axe over every view in both themes and expect zero violations. Both themes
were at zero when this was written, and the failures it found were real ones:
form controls with no accessible name, a text step below 4.5:1, severity
encoded in colour alone, and a link inside a sentence marked only by colour.

The contrast half of that is arithmetic on twelve numbers, so it does not need a
browser: `apps/web/lib/palette.test.ts` holds every step of the text ramp to
4.5:1 against every ground, on every commit. The rest needs the real thing.
