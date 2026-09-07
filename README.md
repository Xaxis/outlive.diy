# outlive.diy

A local-only tool for designing and stress-testing a Bitcoin self-custody and
recovery plan.

You describe the _shape_ of a setup: how many keys, what threshold, which
backups sit where, who can reach them. It tells you where that breaks, then
produces the runbook to build it and the recovery route for each way it can
fail.

The name is the requirement. A custody plan has to work when the person who made
it is not available.

**https://outlive.diy**

## It never touches key material

The app reasons about shapes, never about secrets. There is no field anywhere in
it for a seed word, a mnemonic, an extended key, a descriptor, a private key, a
PIN, a passphrase, an address, a balance, or a transaction. Locations and people
are roles: "Site B", "Successor 1".

Every free-text field runs through an input guard that refuses seed words,
extended keys, WIF keys, addresses, descriptors and long hex strings, and tells
you exactly what it recognised and why. The guard is a feature, not a nuisance.

It makes no network calls. No fonts from a CDN, no analytics, no telemetry, no
update check, no error reporting. The whole application is one static page whose
Content-Security-Policy forbids connecting anywhere at all, and
`make no-network` fails the build if any source in it acquires a way to.

Your plan lives in your browser, and in files you save yourself. Nothing is
sent anywhere, because there is nowhere for it to be sent.

## What the analysis does

Given a plan, it enumerates and reports:

- **Loss.** Remove any key, device, backup, location or person. Is the threshold
  still reachable, and which wallets survive?
- **Compromise.** The same enumeration from the attacker's side. A written
  backup is a key in their hands; a PIN-locked device is not, until they also
  have you.
- **Correlation.** Keys sharing a vendor, devices sharing an architecture,
  locations in one disaster group, backups one person can reach. Independent
  looking failures that are not.
- **Coercion.** What is reachable in a single session with you cooperating,
  which is what compulsion means.
- **Succession.** Whether the people who outlive you can reach the coins, and
  the other failure nobody talks about: whether they can reach them today.
- **Staleness.** What is believed rather than tested.

Findings are ranked by severity with one concrete remediation each. There is no
score, no grade and no progress bar, because a custody plan that gets a B is not
a thing.

## What it produces

A map of keys against locations showing where quorum concentrates. A build
runbook with the verification gates called out. A recovery route for each way it
fails. A successor letter containing no secrets. All of it prints properly,
because these documents get stored on paper next to the backups.

## Honest about what it is

It models structure. It does not know your real threat, cannot verify anything
you tell it, and is not advice. A plan that produces no findings here is a plan
this program could not find a problem with, which is a much smaller claim than
it sounds like.

## Layout

```
packages/core/     The model, the analysis engine, the guard, the documents.
                   No React, no DOM, no network. This is the product.
apps/web/          One static page that renders it.
tools/             Repository self-checks.
docs/              The threat model, the plan file format, the rule catalogue.
```

The engine is separate from the interface because the engine is the thing that
has to be right. Everything in `packages/core` is pure and tested;
`make test` is the suite that matters.

## Working on it

```bash
make install
make dev        # the app at localhost:3000
make check      # everything CI runs
make test       # both suites: the engine, and the interface driven end to end
make offline    # a copy that opens straight from disk, with no server at all
```

Node 24 or newer, Yarn 1.

## Running it with no server

`make offline` builds `apps/web/out` with relative asset paths, so
`apps/web/out/index.html` opens directly in a browser from the filesystem. There
is no back end to miss: the whole application is one document and some
JavaScript. The two typefaces are requested by path and will fall back to your
system stack when opened this way, which is the only difference.

## Licence

MIT. See `LICENSE`.
