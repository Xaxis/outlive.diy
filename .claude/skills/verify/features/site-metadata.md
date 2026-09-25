# Site metadata

Icons, the web manifest, the share image, robots and the sitemap, all emitted as static files.

<!-- covers: api:GET /apple-icon, api:GET /manifest.webmanifest, api:GET /opengraph-image, api:GET /robots.txt, api:GET /sitemap.xml -->

## Sub-features

- apple-icon and opengraph-image: PNGs generated at build.
- manifest: name and description.
- robots and sitemap: the landing page and the terms.

## How to reach it

- `/apple-icon`, `/manifest.webmanifest`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml` on the static build or `https://outlive.diy`.

## How to check it

Static: `make build`.

Runtime:

```sh
for u in apple-icon manifest.webmanifest opengraph-image robots.txt sitemap.xml; do echo "$u $(curl -s -o /dev/null -w '%{http_code} %{content_type}' https://outlive.diy/$u)"; done
curl -s https://outlive.diy/sitemap.xml | grep -o '<loc>[^<]*'
```

Proves it when: every line is `200` with an image or text type, and the sitemap lists `https://outlive.diy` and `https://outlive.diy/terms/`.

## Gotchas

- The PNG routes have no extension, so `vercel.json` sets their content type.
