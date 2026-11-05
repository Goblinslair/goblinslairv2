# Deploying Goblin's Lair (for the shop owner and his AI agent)

The site runs on a DigitalOcean droplet that is shared with another project
(GradeMaster, Chris's demo). Your login has **full passwordless sudo**, so you
can manage the server yourself. For the site itself, still use
`goblinslair-ctl` and `deploy.sh` below, so release names, rollback and the
action log stay consistent.

**Please don't lock Chris out:** leave root's SSH access
(`/root/.ssh/authorized_keys`, `PermitRootLogin`), `sshd_config` and the
firewall's SSH rule alone.

- **Server:** `159.65.171.134`
- **Your login:** `goblinstarv` (your own SSH key)
- **Live site:** https://goblinslair.com.my
- **Code:** the `krispy` branch of this repo. Deploy only from an
  up-to-date `krispy` (`git pull` first). `deploy.sh` refuses if you are behind.

## Deploy

From the repo root on your own machine, with a clean `krispy` checkout:

```bash
GOBLINS_USER=goblinstarv GOBLINS_SITE_URL=https://goblinslair.com.my ./deploy.sh
```

It builds locally, uploads to `/srv/goblinslair/deployment/<release>/`, and
runs `sudo goblinslair-ctl deploy <release>` on the server. If the new
release does not answer, the server switches back to the old one by itself
and deletes the broken one. Add `GOBLINS_KEY=~/.ssh/<your key>` if your key
is not the default one.

Always pass `GOBLINS_SITE_URL=https://goblinslair.com.my`. The site address
is built into the pages (canonical links, sitemap, payment return URLs).

## Levers (on the server)

```bash
ssh goblinstarv@159.65.171.134
sudo goblinslair-ctl help
```

| Command | What it does |
|---|---|
| `sudo goblinslair-ctl status` | Live release, service state, home page check, free disk |
| `sudo goblinslair-ctl releases` | Releases on the server, newest first, `*` = live |
| `sudo goblinslair-ctl logs [LINES]` | The site's log (default 100 lines, max 2000) |
| `sudo goblinslair-ctl restart` | Restart the site, then check it |
| `sudo goblinslair-ctl deploy RELEASE` | Put an uploaded build live (`deploy.sh` does this for you) |
| `sudo goblinslair-ctl rollback` | Go back to the release before the live one |
| `sudo goblinslair-ctl switch RELEASE` | Make any release on the server live, e.g. to undo a rollback |

Release names start with the **UTC** time (`date -u +%Y%m%d%H%M%S`), and
`deploy` refuses a name more than an hour off the server's clock. Names sort
by time, and `rollback` relies on that order.

The newest 3 releases are kept. The live one is never deleted. Uploads that
never get deployed are deleted after 24 hours. Every command is logged to
`/var/log/goblinslair-ctl.log`.

## Everything else

With full sudo you can change nginx, certificates, `shared/.env` and so on
yourself. `../SERVER.md` describes how it's all set up today. Please keep
it up to date when you change something, so the next person (or agent)
knows.

## Files here

- `goblinslair-ctl`: the lever script, installed as `/usr/local/sbin/goblinslair-ctl`.
- `sudoers-goblinslair`: the narrow sudo rule for just the levers, installed as `/etc/sudoers.d/goblinslair`. Full sudo is a separate file, `/etc/sudoers.d/goblinstarv-full`, not in the repo.
- `install.sh`: installs both (run by Chris, as root). Re-run it after changing either file.

More about the server as a whole: `../SERVER.md`.
