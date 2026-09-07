# What this program assumes

This is the honest version of "is it safe to use". It is written so that a
reader can check each claim against the source rather than take it on trust.

## What the application can do

It runs entirely in the browser tab. It reads and writes one origin's local
storage, reads files the user picks, and writes files the user saves. That is
the complete list of its capabilities.

It cannot make a network request. The deployed `Content-Security-Policy` sets
`connect-src 'none'`, so `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`
and `sendBeacon` are refused by the browser regardless of what the code asks
for. `tools/check-no-network.mjs` runs in CI and fails the build if any source
in `apps/web` or `packages/core/src` acquires a way to make one, or references
a host that is not on a short allowlist.

The page is a static export with no server component, no API route and no
runtime environment variables. There is no back end to send anything to.

Two honest caveats about the policy, because a claim nobody can check is not
worth making:

- `script-src` includes `'unsafe-inline'`. It has to: the framework inlines its
  own bootstrap data into the document, and a static export cannot carry a
  nonce. What that costs is real but narrow, because the lines that actually
  prevent data leaving (`connect-src 'none'`, `img-src 'self' data:`,
  `form-action 'none'`) hold regardless of what script runs.
- Content-Security-Policy does not restrict ordinary navigation. It stops a
  request, a form post and a beacon; it does not stop a link. The protection
  here is that there is no code that would follow one, and the repository check
  fails if a link to an unlisted host appears in the source.

## What it will not accept

The model has no field capable of holding a secret. `packages/core/src/model/types.ts`
is the whole vocabulary: keys, devices, locations, wallets, people, backups and
verifications, described by role and by shape.

`packages/core/src/guard/guard.ts` inspects every free-text value and refuses:

- runs of BIP-39 wordlist words (see the two thresholds documented in the file)
- extended keys, public or private, in any of the common prefixes
- WIF private keys, mainnet and testnet
- bech32 addresses
- output descriptors
- hexadecimal strings of 64 characters or more
- PEM private key blocks

It warns, without blocking, about email addresses, phone numbers, street
addresses, coordinates, URLs and derivation paths. Those are not key material,
but they are the kind of personal detail this model is designed not to hold.

A plan file is inspected the same way at the moment it is opened, so a file
carrying key material is refused at the door rather than loaded and silently
written back to local storage.

## What it does not protect against

**The machine.** If the computer running the browser is compromised, everything
on the screen is compromised. This program cannot help with that, and the
memory-only storage mode exists so that a user on a machine they do not trust
can at least decline to leave anything behind.

**The browser profile.** In the default mode the plan is in local storage, and
anybody with that browser profile can read it. The plan holds no secrets, but it
does describe the shape of a custody setup, which is worth something to an
attacker who already knows who you are.

**Someone reading over your shoulder.** Site labels are roles, and the notes
fields are yours to fill in; nothing stops a user writing something they should
not, beyond the guard and the copy asking them not to.

**Being wrong.** The engine reasons about what it was told. It cannot see the
backups, cannot verify a claim, and only knows the failure modes it has rules
for. A plan with no findings is a plan this program could not find a problem
with.

## What it deliberately does not know

Fees, transaction construction, address reuse, network privacy and anything
on-chain. Device-specific facts, unless the user loads their own dated vendor
file. Law, beyond modelling probate as a delay and jurisdiction as a grouping.

## Third parties

None at runtime. Two typefaces are checked into the repository and served from
this origin. At build time the project depends on npm packages, listed in
`yarn.lock` and pinned by `--frozen-lockfile`, and the BIP-39 wordlist is
generated from `@scure/bip39` and verified against the canonical hash before it
is written.
