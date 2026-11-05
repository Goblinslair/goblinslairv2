#!/usr/bin/env bash
#
# Sets up the hourly product sync on the droplet: a random SYNC_SECRET in
# shared/.env (only added if missing, never printed) plus a systemd service
# and timer. Run from the repo root as a user with sudo on the droplet:
#
#     GOBLINS_USER=goblinstarv ./deployment/install-sync.sh
#
# Safe to re-run. Restarts the goblinslair service only when it adds the secret.

set -euo pipefail

HOST="${GOBLINS_HOST:-159.65.171.134}"
USER_ON_SERVER="${GOBLINS_USER:-root}"
SSH=(ssh -o ConnectTimeout=15)
SCP=(scp -q -o ConnectTimeout=15)
[ -n "${GOBLINS_KEY:-}" ] && { SSH+=(-i "$GOBLINS_KEY"); SCP+=(-i "$GOBLINS_KEY"); }
cd "$(dirname "$0")"

"${SCP[@]}" goblinslair-sync.service goblinslair-sync.timer "${USER_ON_SERVER}@${HOST}:/tmp/"

"${SSH[@]}" "${USER_ON_SERVER}@${HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail
if [ "$(id -u)" = 0 ]; then SUDO=""; else SUDO="sudo -n"; fi
ENV_FILE=/srv/goblinslair/shared/.env

$SUDO install -o root -g root -m 644 /tmp/goblinslair-sync.service /etc/systemd/system/goblinslair-sync.service
$SUDO install -o root -g root -m 644 /tmp/goblinslair-sync.timer /etc/systemd/system/goblinslair-sync.timer
rm -f /tmp/goblinslair-sync.service /tmp/goblinslair-sync.timer

restart=0
if ! $SUDO grep -q '^SYNC_SECRET=.' "$ENV_FILE"; then
  # Start on a new line if the file does not end with one.
  if [ -n "$($SUDO tail -c1 "$ENV_FILE")" ]; then echo | $SUDO tee -a "$ENV_FILE" >/dev/null; fi
  echo "SYNC_SECRET=$(openssl rand -hex 32)" | $SUDO tee -a "$ENV_FILE" >/dev/null
  restart=1
  echo "SYNC_SECRET added."
else
  echo "SYNC_SECRET already set."
fi

if [ "$restart" = 1 ]; then
  $SUDO goblinslair-ctl restart
fi

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now goblinslair-sync.timer
systemctl list-timers goblinslair-sync.timer --no-pager
REMOTE
