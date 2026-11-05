#!/usr/bin/env bash
#
# One-time (and re-runnable) setup of the deploy levers on the droplet.
# Run from the repo root on your own machine, as root on the droplet:
#
#     ./deployment/install.sh
#
# It copies goblinslair-ctl and the sudoers rule up, and prepares the upload
# folder. It does not touch nginx, certificates, the firewall, the .env file
# or GradeMaster.

set -euo pipefail

HOST="${GOBLINS_HOST:-159.65.171.134}"
KEY="${GOBLINS_KEY:-$HOME/.ssh/grademaster_vps}"
DEPLOY_USER="${GOBLINS_DEPLOY_USER:-goblinstarv}"

cd "$(dirname "$0")"

ssh_root() { ssh -i "$KEY" -o ConnectTimeout=15 "root@${HOST}" "$@"; }

echo "==> Uploading goblinslair-ctl and sudoers rule"
scp -q -i "$KEY" goblinslair-ctl sudoers-goblinslair "root@${HOST}:/root/"

echo "==> Installing on ${HOST}"
ssh_root DEPLOY_USER="$DEPLOY_USER" 'bash -s' <<'REMOTE'
set -euo pipefail

id "$DEPLOY_USER" >/dev/null

install -o root -g root -m 755 /root/goblinslair-ctl /usr/local/sbin/goblinslair-ctl

# Check the sudoers file before it goes live; a broken one can lock out sudo.
sed "s/^goblinstarv /${DEPLOY_USER} /" /root/sudoers-goblinslair > /root/sudoers-goblinslair.checked
visudo -cf /root/sudoers-goblinslair.checked
install -o root -g root -m 440 /root/sudoers-goblinslair.checked /etc/sudoers.d/goblinslair
rm -f /root/goblinslair-ctl /root/sudoers-goblinslair /root/sudoers-goblinslair.checked

# releases/ becomes root-owned so the app user (and anything it runs) can no
# longer plant files there that root later acts on. Each release folder stays
# owned by goblins, which npm ci needs.
chown root:root /srv/goblinslair/releases
chmod 755 /srv/goblinslair/releases

# Where builds are uploaded before `goblinslair-ctl deploy` moves them.
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 /srv/goblinslair/deployment

touch /var/log/goblinslair-ctl.log
chown root:root /var/log/goblinslair-ctl.log
chmod 644 /var/log/goblinslair-ctl.log

echo "installed:"
ls -l /usr/local/sbin/goblinslair-ctl /etc/sudoers.d/goblinslair
ls -ld /srv/goblinslair/releases /srv/goblinslair/deployment
runuser -u "$DEPLOY_USER" -- sudo -n /usr/local/sbin/goblinslair-ctl status
REMOTE
