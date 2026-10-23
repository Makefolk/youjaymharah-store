FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/docs/package.json ./apps/docs/package.json
RUN --mount=type=cache,id=youjaymharah-docs-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --filter @youjaymharah/docs --frozen-lockfile
COPY apps/docs ./apps/docs
COPY apps/storefront/app/globals.css ./apps/storefront/app/globals.css
COPY docs ./docs
RUN pnpm --dir apps/docs run build

FROM caddy:2-alpine
ENV XDG_CONFIG_HOME=/tmp/config XDG_DATA_HOME=/tmp/data
COPY apps/docs/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/docs/dist /srv
USER 10001:10001
EXPOSE 8080
