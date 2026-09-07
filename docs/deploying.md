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

From a checkout with `VERCEL_TOKEN` in `.env`:

```bash
make preview   # a preview deployment
make deploy    # production
```

`vercel git connect` could not attach the GitHub repository from the CLI, which
usually means the Vercel GitHub App is not installed on the account. Connecting
it in the Vercel dashboard, under the project's Git settings, turns every push
to `main` into a deploy and makes the two commands above unnecessary. That is
worth doing, and is better than putting a deploy token into GitHub Actions
secrets, which duplicates a credential for no gain.

## DNS

`outlive.diy` is registered at Namecheap and both it and `www` are attached to
the project. As of writing, the nameservers still point at Namecheap's parking
page, so the records have to be set under **Domain, Advanced DNS**:

| Type  | Host  | Value                                  |
| ----- | ----- | -------------------------------------- |
| A     | `@`   | `216.150.1.1`                          |
| A     | `@`   | `216.150.16.1`                         |
| CNAME | `www` | `99818ac90fed2397.vercel-dns-016.com.` |

Delete the parking-page `CNAME www` and the `A @` pointing at
`162.255.119.192` first, or they will conflict.

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
