#!/usr/bin/env bash
#
# Deploy the site to the DigitalOcean droplet.
#
# Run this from your own machine, on the krispy branch:
#
#     GOBLINS_SITE_URL=https://goblinslair.com.my ./deploy.sh
#
# The shop owner deploys the same way, as his own login:
#
#     GOBLINS_USER=goblinstarv GOBLINS_SITE_URL=https://goblinslair.com.my ./deploy.sh
#
# This does not go through GitHub or Vercel at all. It builds here with the
# Node adapter (DEPLOY_TARGET=node, see astro.config.mjs), uploads the build
# to /srv/goblinslair/deployment/<release>/ on the droplet, then runs
# `goblinslair-ctl deploy <release>` there. That server-side script (source in
# deployment/goblinslair-ctl) installs packages, switches the live site over,
# restarts it and checks it, and switches back by itself if the new release
# does not answer. Non-root users run it through a sudo rule that allows only
# that one script.
#
# Layout on the droplet:
#
#     /srv/goblinslair/deployment/<release>/    uploads waiting to go live
#     /srv/goblinslair/releases/<time>-<sha>/   one folder per deploy, last 3 kept
#     /srv/goblinslair/current                  link to the live release
#     /srv/goblinslair/shared/.env              secrets, read by the systemd unit
#
# The droplet is shared with GradeMaster. Nothing here touches anything
# outside /srv/goblinslair and the goblinslair service. See SERVER.md.

set -euo pipefail

HOST="${GOBLINS_HOST:-159.65.171.134}"
USER_ON_SERVER="${GOBLINS_USER:-root}"
SITE_URL="${GOBLINS_SITE_URL:?Set GOBLINS_SITE_URL to the public URL of the site, e.g. https://goblinslair.com.my}"
BRANCH="krispy"
CTL="/usr/local/sbin/goblinslair-ctl"
UPLOADS="/srv/goblinslair/deployment"

# root uses Chris's droplet key by default; anyone else uses their own ssh
# setup unless GOBLINS_KEY says otherwise.
if [ -n "${GOBLINS_KEY:-}" ]; then
  KEY="$GOBLINS_KEY"
elif [ "$USER_ON_SERVER" = root ]; then
  KEY="$HOME/.ssh/grademaster_vps"
else
  KEY=""
fi
SSH_OPTS=(-o ConnectTimeout=15)
[ -n "$KEY" ] && SSH_OPTS+=(-i "$KEY")
SUDO=""
[ "$USER_ON_SERVER" = root ] || SUDO="sudo -n"

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

# More than one person deploys. Refuse to put an older copy of the branch
# live over someone else's newer work.
if git fetch -q origin "$BRANCH" 2>/dev/null; then
  behind="$(git rev-list --count "HEAD..origin/${BRANCH}")"
  if [ "$behind" != 0 ]; then
    echo "Your ${BRANCH} is ${behind} commit(s) behind origin/${BRANCH}. Run 'git pull' first." >&2
    exit 1
  fi
else
  echo "(No origin/${BRANCH} to compare with; skipping the up-to-date check.)"
fi

sha="$(git rev-parse --short HEAD)"
# UTC, always: release names sort by time on the server (rollback picks the
# one before the live one by name), so every deployer must use the same clock.
release="$(date -u +%Y%m%d%H%M%S)-${sha}"

say "Building ${sha} for ${SITE_URL}"
npm ci
rm -rf dist
DEPLOY_TARGET=node SITE_URL="$SITE_URL" npm run build
[ -f dist/server/entry.mjs ] || { echo "Build did not produce dist/server/entry.mjs." >&2; exit 1; }

# --- upload and switch over --------------------------------------------------

say "Uploading release ${release} as ${USER_ON_SERVER}"
rsync -az -e "ssh ${SSH_OPTS[*]}" \
  dist package.json package-lock.json \
  "${USER_ON_SERVER}@${HOST}:${UPLOADS}/${release}/"

say "Putting ${release} live on ${HOST}"
ssh "${SSH_OPTS[@]}" "${USER_ON_SERVER}@${HOST}" ${SUDO} "${CTL}" deploy "${release}"

say "Done — ${release} is live at ${SITE_URL}"
