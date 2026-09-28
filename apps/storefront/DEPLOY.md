# Deploy Notes — Storefront

## How the storefront talks to Medusa

- **Server Components** call Medusa directly with the server SDK
  (`lib/medusa/server.ts`), server to server.
- **The browser never calls Medusa.** Client Components use
  `getBrowserSdk()` (`lib/medusa/browser.ts`), which goes through this app's
  `/api/medusa` proxy. The proxy attaches the customer's token from an httpOnly
  cookie, so no token ever reaches browser JavaScript, and it forwards only
  `/store/*` routes.
- **Sign-in** runs in Route Handlers under `/api/auth/*`, which set and clear
  that cookie.

Because of this, the storefront and backend do **not** need to share a domain.

For building features on this setup, see `DATA-LAYER.md`.

## Production image

Production runs `apps/storefront/Dockerfile` (Next.js standalone output)
behind Caddy on the VPS; the full setup is in
[docs/deployment.md](../../docs/deployment.md). Two things differ from a
local build:

- **Build time needs a live API.** `next build` prerenders pages (the root
  layout loads settings, categories and collections), so the Deploy workflow
  builds this image after the backend is deployed, with
  `MEDUSA_BACKEND_URL=https://api.<domain>`. At runtime the container uses
  `http://medusa-server:9000` over the Docker network instead.
- **`NEXT_PUBLIC_*` and `IMAGE_REMOTE_URLS` are compiled in.** They come from
  the GitHub Environment's variables. Changing one means a new deploy, not a
  container restart. Each image therefore belongs to one deployment and is
  tagged `<sha>-<environment>`.

`output: "standalone"` is switched on only by the Docker build
(`NEXT_OUTPUT_STANDALONE=true`), so `pnpm start` keeps working locally.
`GET /api/health` answers without calling Medusa, so a backend restart doesn't
also mark the storefront down. The deploy's checks use it; the container has no
Docker health check.

## Backend settings that depend on the storefront URL

Set these on the **backend** once the storefront has its URL:

| Variable               | Value                                           |
| ---------------------- | ----------------------------------------------- |
| `GOOGLE_CALLBACK_URL`  | `https://<storefront>/api/auth/google/callback` |
| `PAYMENT_CALLBACK_URL` | `https://<storefront>/checkout/callback`        |
| `STOREFRONT_URL`       | `https://<storefront>` (links in emails)        |

`STORE_CORS` does not need the storefront origin while all browser traffic goes
through the proxy; production sets it to the storefront origin anyway, so a
future direct call works.

## Known gotchas

- **Sessions last one day.** The `_medusa_jwt` cookie matches Medusa's default
  `jwtExpiresIn` of `1d`, and nothing refreshes it, so customers sign in again
  daily. To lengthen it, raise `projectConfig.http.jwtExpiresIn` in the
  backend's `medusa-config.ts` and `AUTH_MAX_AGE_SECONDS` in
  `lib/medusa/session.ts` together.
- **Preview deployments** work without extra configuration: the browser SDK
  builds its URL from the page's own origin.
- **Measuring the proxy.** Every proxied response carries a `Server-Timing`
  header; the browser's Network tab shows how long Medusa took.
