# Deploying

The site is a static export. There is no server, no API route and no runtime
environment variable, so a deploy is a file upload and nothing else.

## Vercel

Project `outlive-diy` under the `xaxis-projects` team, configured entirely by
`vercel.json` at the repository root:

```
buildCommand      yarn workspace @outlive/web build
installCommand    yarn install --frozen-lockfile
outputDirectory   apps/web/out
framework         null   (it is a static directory, not a Next.js server)
```

The GitHub repository is connected, with `main` as the production branch. A
push to `main` deploys production and a pull request gets its own preview, so
in normal use nobody runs a deploy command at all.

The deploy does not wait for the `check` workflow, because the two run against
the same commit at the same time. A red check on a green deploy means the
commit is live and wrong, and the fix is to push the correction, which is the
same fix as everywhere else on a project with one branch.

From a checkout with `VERCEL_TOKEN` in `.env`, for the times when the
integration is not the right tool:

```bash
make preview   # a preview deployment
make deploy    # production
```

The token stays in `.env` and out of GitHub Actions secrets. Actions has no
reason to deploy now that Vercel does it, and a second copy of a credential is
a second thing to leak.

## DNS

`outlive.diy` is registered at Namecheap and both it and `www` are attached to
the project. The nameservers stay at Namecheap, so the records are set by hand
under **Domain, Advanced DNS**, and these are the ones in place:

| Type  | Host  | Value                                  |
| ----- | ----- | -------------------------------------- |
| A     | `@`   | `216.150.1.1`                          |
| A     | `@`   | `216.150.16.1`                         |
| CNAME | `www` | `99818ac90fed2397.vercel-dns-016.com.` |

The parking-page `CNAME www` and the `A @` pointing at `162.255.119.192` have
to go first, or they conflict with these.

`www` is configured in Vercel to redirect to the apex with a 308, so the site
has one address.

## Response headers

Set in `vercel.json`, and the reason the central claim is enforceable rather
than promised:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';
  connect-src 'none'; form-action 'none'; frame-ancestors 'none';
  base-uri 'none'; object-src 'none'; manifest-src 'self'
```

`connect-src 'none'` is the line that matters: the browser refuses every
request the page could make, whatever the code asks for. The caveats are in
`threat-model.md`, stated rather than glossed.

The generated share card and touch icon are emitted without a file extension by
the framework, so both are given `Content-Type: image/png` explicitly.

## Checking a deploy

```bash
curl -sI https://outlive.diy/ | grep -i content-security-policy
```

Then open the page with the network tab visible and use it. Nothing should
appear after the initial load. That check takes ten seconds and is worth more
than this document.
