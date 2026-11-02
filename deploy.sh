#!/usr/bin/env bash
#
# Deploy the site to the DigitalOcean droplet.
#
# Run this from your own machine, on the krispy branch:
#
#     GOBLINS_SITE_URL=https://your-domain ./deploy.sh
#
# This does not go through GitHub or Vercel at all. It builds here with the
# Node adapter (DEPLOY_TARGET=node, see astro.config.mjs), copies the build
# into a new release folder on the droplet, installs production dependencies
# there, points the `current` link at it and restarts the service. If the new
# release does not answer, it switches back to the previous one.
#
# Layout on the droplet:
#
#     /srv/goblinslair/releases/<time>-<sha>/   one folder per deploy, last 3 kept
#     /srv/goblinslair/current                  link to the live release
#     /srv/goblinslair/shared/.env              secrets, read by the systemd unit
#
# The droplet is shared with GradeMaster. This script only ever touches
# /srv/goblinslair and the goblinslair service.

set -euo pipefail

HOST="${GOBLINS_HOST:-159.65.171.134}"
KEY="${GOBLINS_KEY:-$HOME/.ssh/grademaster_vps}"
SITE_URL="${GOBLINS_SITE_URL:?Set GOBLINS_SITE_URL to the site's public URL, e.g. https://example.com}"
APP_USER="goblins"
APP_DIR="/srv/goblinslair"
SERVICE="goblinslair"
PORT="4321"
BRANCH="krispy"
KEEP_RELEASES=3

say() { printf '\n==> %s\n' "$1"; }

# --- checks on this machine, before touching the server ---------------------

cd "$(dirname "$0")"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "$BRANCH" ]; then
  echo "On '${current_branch}', not '${BRANCH}'. Switch branches first." >&2
  exit 1
fi

# A clean tree means the release name (its commit) says exactly what is live.
if [ -n "$(git status --porcelain)" ]; then
  echo "You have uncommitted changes. Commit or stash them first." >&2
  git status --short >&2
  exit 1
fi

sha="$(git rev-parse --short HEAD)"
release="$(date +%Y%m%d%H%M%S)-${sha}"
site_host="$(node -p "new URL(process.argv[1]).hostname" "$SITE_URL")"

say "Building ${sha} for ${SITE_URL}"
npm ci
rm -rf dist
DEPLOY_TARGET=node SITE_URL="$SITE_URL" npm run build
[ -f dist/server/entry.mjs ] || { echo "Build did not produce dist/server/entry.mjs." >&2; exit 1; }

# --- copy the release up ----------------------------------------------------

say "Uploading release ${release}"
ssh -i "$KEY" -o ConnectTimeout=15 "root@${HOST}" "mkdir -p '${APP_DIR}/releases/${release}'"
rsync -az --delete -e "ssh -i $KEY" \
  dist package.json package-lock.json \
  "root@${HOST}:${APP_DIR}/releases/${release}/"

# --- everything below runs on the droplet -----------------------------------

say "Switching over on ${HOST}"

ssh -i "$KEY" -o ConnectTimeout=15 "root@${HOST}" \
  APP_USER="$APP_USER" APP_DIR="$APP_DIR" SERVICE="$SERVICE" PORT="$PORT" \
  RELEASE="$release" SITE_HOST="$site_host" KEEP_RELEASES="$KEEP_RELEASES" \
  'bash -s' <<'REMOTE'
set -euo pipefail
say() { printf '\n--> %s\n' "$1"; }

new="${APP_DIR}/releases/${RELEASE}"
chown -R "${APP_USER}:${APP_USER}" "$new"

say "Installing production dependencies"
# Installed here rather than copied up, so sharp gets its Linux binary.
runuser -u "$APP_USER" -- npm --prefix "$new" ci --omit=dev --no-audit --no-fund

previous="$(readlink -f "${APP_DIR}/current" 2>/dev/null || true)"

say "Pointing current at ${RELEASE}"
ln -sfn "$new" "${APP_DIR}/current.tmp"
mv -T "${APP_DIR}/current.tmp" "${APP_DIR}/current"
systemctl restart "$SERVICE"

say "Checking"
code=""
for _ in $(seq 1 15); do
  sleep 1
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${SITE_HOST}" "http://127.0.0.1:${PORT}/" || true)"
  [ "$code" = "200" ] && break
done
echo "home page: ${code}"

if [ "$code" != "200" ]; then
  echo "New release did not answer with 200." >&2
  journalctl -u "$SERVICE" -n 30 --no-pager >&2 || true
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    echo "Switching back to $(basename "$previous")." >&2
    ln -sfn "$previous" "${APP_DIR}/current.tmp"
    mv -T "${APP_DIR}/current.tmp" "${APP_DIR}/current"
    systemctl restart "$SERVICE"
  fi
  exit 1
fi

say "Removing old releases (keeping ${KEEP_RELEASES})"
ls -1dt "${APP_DIR}"/releases/*/ | tail -n +"$((KEEP_RELEASES + 1))" | xargs -r rm -rf
ls -1t "${APP_DIR}/releases"
REMOTE

say "Done — ${release} is live at ${SITE_URL}"
