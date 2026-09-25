# Shell

Three documents joined by page loads: the landing page, the app, the terms; plus the palette, the offline copy and the network check.

<!-- covers: command:make no-network, command:make offline, page:/, page:/app, page:/terms, shortcut:Cmd-K palette -->

## Sub-features

- landing: `/` is always the landing page; with plans stored it lists them under "Your plans" with a Continue button each.
- worked examples: opening one from `/` loads `/app/#/findings` with that plan.
- legacy links: `/#/view` forwards to `/app/#/view`, on load and on a later hash change.
- app: `/app/` draws nothing until storage is read; with no plan it shows the start screen.
- home: the logo and the sidebar's Home load `/`.
- terms: `/terms/`, linked from the landing footer, the sidebar and the scope notice.
- palette: Cmd-K or Ctrl-K opens "Go to"; words must begin words; Enter goes.
- no-overwrite: any store action that writes reads storage first, so the landing page cannot replace saved plans.
- offline: `make offline` output opens from disk and works end to end.
- no-network: `make no-network` allows the SDK in one file and one host in the policy.

## How to reach it

- `http://localhost:$PORT/`, `/app/`, `/terms/`; logo; sidebar Home; Cmd-K inside `/app/`.
- `make offline` then `apps/web/out/index.html` from disk.

## How to check it

Static: `make test-web` (`components/shell/App.test.tsx`: "the way home", "the terms", "going anywhere by name"; `ViewBoundary.test.tsx`); `make no-network`.

Runtime:

```sh
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "Two of three, three sites" --path / --print "(await p.getByText('Your plans').count()) + ' ' + (await p.getByRole('link',{name:'Open your plan'}).count())"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --path "/#/map" --print "p.url()"
PW=/tmp/outlive-pw node .claude/skills/verify/scripts/drive.mjs --base http://localhost:$PORT --example "One signer, one backup" --path "/app/#/overview" --do "await p.keyboard.press('Control+k'); await p.keyboard.type('site a opened'); await p.keyboard.press('Enter')" --print "p.url()"
curl -sI https://outlive.diy/ | grep -io "connect-src[^;]*"
make offline && PW=/tmp/outlive-pw node -e "const {chromium}=require('/tmp/outlive-pw/node_modules/playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();const bad=[];p.on('requestfailed',r=>bad.push(r.url()));await p.goto('file://'+process.cwd()+'/apps/web/out/index.html');await p.locator('main ul button').nth(1).click();await p.waitForTimeout(2000);console.log(p.url().split('/out/')[1],bad);await b.close()})()"
```

Proves it when: the first prints `1 1`; the second prints a URL ending `/app/#/map`; the third ends `/app/#/map/location-compromised%3Aloc_home`; the curl prints `connect-src https://api.anthropic.com`; the offline run prints `app/index.html#/findings []`. Every driver line shows `outside requests: []`.

## Gotchas

- Navigation between documents is a real page load; the framework's client-side navigation would fetch and the policy forbids it. Use `lib/site.ts` and plain anchors.
- Hosted links are absolute and offline ones relative; `tools/relative-assets.mjs` rewrites them and copies `_next` into `app/` and `terms/`.
- In jsdom tests the page lives at `/app/` (see `test/setup.ts`); cross-document navigation is asserted by `href` or a stubbed `location.assign`, because jsdom cannot load pages.
