#!/usr/bin/env bash
# Rolls one part of the stack to a new image tag, on the VPS.
#
#   deploy.sh backend <tag>      migrate, then Medusa server + worker + admin
#   deploy.sh storefront <tag>   the Next.js storefront
#
# <tag> is the commit SHA the images were built from. The admin and storefront
# images carry the environment as a suffix (<tag>-<ENVIRONMENT>).
#   deploy.sh status             tags currently deployed
#
# Images are built and pushed by GitHub Actions; this only pulls them. Pass
# --registry-user <user> and the token on stdin to log in to GHCR for the pull
# (the workflow sends its short-lived job token); without it, the images must
# already be present or the host already logged in. --environment <name>
# refuses to run unless it matches ENVIRONMENT in .env, so a workflow aimed at
# one environment cannot roll images onto a host set up for another.
#
# On a failed rollout the previous tag is started again and the script exits
# non-zero. Migrations are NOT reverted: see docs/deployment.md.

set -euo pipefail

cd "$(dirname "$0")"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

registry_user=""
expected_environment=""
args=()
while (($#)); do
  case "$1" in
    --registry-user) registry_user="$2"; shift 2 ;;
    --environment) expected_environment="$2"; shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
set -- "${args[@]+"${args[@]}"}"

[[ -f .env ]] || fail ".env is missing (copy .env.template)."
[[ -f backend.env ]] || fail "backend.env is missing (copy backend.env.template)."

env_get() { sed -n "s/^$1=//p" .env | tail -n1; }

env_set() {
  if grep -q "^$1=" .env; then
    sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

compose() { docker compose "$@"; }

if [[ "${1:-}" == "status" ]]; then
  echo "backend:    $(env_get BACKEND_TAG) (previous: $(env_get PREVIOUS_BACKEND_TAG))"
  echo "storefront: $(env_get STOREFRONT_TAG) (previous: $(env_get PREVIOUS_STOREFRONT_TAG))"
  compose ps
  exit 0
fi

target="${1:-}"
tag="${2:-}"
[[ "$target" == "backend" || "$target" == "storefront" ]] && [[ -n "$tag" ]] \
  || fail "usage: deploy.sh backend|storefront <tag>  |  deploy.sh status"
[[ "$tag" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "invalid tag: $tag"

# Two deploys must never interleave: one could migrate under the other's code.
exec 9> .deploy.lock
flock -n 9 || fail "another deploy is running on this host."

domain="$(env_get DOMAIN)"
[[ -n "$domain" ]] || fail "DOMAIN is not set in .env."
environment="$(env_get ENVIRONMENT)"
[[ -n "$environment" ]] || fail "ENVIRONMENT is not set in .env."
[[ -z "$expected_environment" || "$expected_environment" == "$environment" ]] \
  || fail "this host is '$environment', not '$expected_environment'."

if [[ "$target" == "backend" ]]; then
  tag_var=BACKEND_TAG
  services=(medusa-server medusa-worker admin)
else
  tag_var=STOREFRONT_TAG
  services=(storefront)
fi

previous="$(env_get "$tag_var")"

export "$tag_var=$tag"

# Without a login (a manual rollback on the host, say), images already here
# are used as they are and only missing ones are pulled, by `up` below.
if [[ -n "$registry_user" ]]; then
  log "Logging in to ghcr.io as $registry_user"
  docker login ghcr.io -u "$registry_user" --password-stdin
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  log "Pulling ${services[*]} at $tag"
  compose pull "${services[@]}"
fi

# Redis and Caddy change rarely; `up` leaves them alone unless their
# definition changed. Caddy re-reads its config in place, without dropping
# connections, so routing changes shipped with this deploy apply too.
log "Ensuring Redis and Caddy are up"
compose up -d --wait redis caddy
compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

if [[ "$target" == "backend" ]]; then
  # A one-off container of the NEW image migrates while the old one keeps
  # serving, so migrations must stay backward compatible with the running
  # code (add first, remove in a later release). "server" mode keeps this
  # process from consuming queued jobs or seeding search while it runs.
  # db:migrate also creates or rebuilds search indexes; the worker fills them
  # when it starts. --all-or-nothing reverts this run's migrations if one
  # fails. --execute-safe-links applies link changes that drop nothing;
  # anything destructive is reported and left for a person to run deliberately.
  log "Running database migrations"
  compose run --rm -T --no-deps medusa-server \
    medusa db:migrate --skip-scripts --execute-safe-links --all-or-nothing \
    || fail "migrations failed; the running version was left untouched."

  # A separate step, not left to db:migrate: Medusa 2.20 runs the migration
  # scripts from db:migrate but discards their exit code, so a failed seed
  # would still let the release go out on a half-seeded database. Completed
  # scripts are recorded and skipped; a failed one runs again next deploy.
  log "Running migration scripts"
  compose run --rm -T --no-deps medusa-server \
    medusa db:migrate:scripts \
    || fail "migration scripts failed; the schema migrations above were applied, but the running version was left untouched."
fi

rollback() {
  if [[ -n "$previous" && "$previous" != "$tag" ]]; then
    log "Rolling ${services[*]} back to $previous"
    export "$tag_var=$previous"
    compose up -d --wait --wait-timeout 300 "${services[@]}" || true
  fi
  fail "$1"
}

log "Starting ${services[*]} at $tag"
compose up -d --wait --wait-timeout 300 "${services[@]}" \
  || rollback "${services[*]} did not become healthy."

# Through Caddy on this host, so routing is checked independently of DNS and
# Cloudflare. -k because the certificate may not be issued yet on a first
# deploy; the workflow checks the public URLs with full TLS afterwards.
check() {
  local host="$1" path="$2"
  for _ in $(seq 1 10); do
    if curl -fsSk -o /dev/null --max-time 10 \
      --resolve "$host:443:127.0.0.1" "https://$host$path"; then
      echo "ok   https://$host$path"
      return 0
    fi
    sleep 3
  done
  echo "FAIL https://$host$path"
  return 1
}

log "Checking routes through Caddy"
if [[ "$target" == "backend" ]]; then
  { check "api.$domain" /health && check "admin.$domain" /; } \
    || rollback "health checks through Caddy failed."
else
  check "$domain" /api/health || rollback "health checks through Caddy failed."
fi

env_set "PREVIOUS_$tag_var" "$previous"
env_set "$tag_var" "$tag"
log "Deployed $target $tag (previous: ${previous:-none})"

# Keep the images for the current and previous tag so a rollback needs no
# pull; remove older ones of this stack only. `docker image rm` refuses
# images a container still uses, so this cannot break anything running.
prefix="$(env_get IMAGE_PREFIX)"
if [[ "$target" == "backend" ]]; then repos=(backend admin); else repos=(storefront); fi
for repo in "${repos[@]}"; do
  docker image ls "$prefix/$repo" --format '{{.Tag}}' \
    | grep -vxF -e "$tag" -e "$tag-$environment" -e "$previous" \
      -e "$previous-$environment" -e '<none>' \
    | while read -r old; do
        docker image rm "$prefix/$repo:$old" >/dev/null 2>&1 || true
      done || true
done
docker image prune -f >/dev/null
