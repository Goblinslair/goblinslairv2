# Deploying Goblin's Lair (for the shop owner and his AI agent)

The site runs on a DigitalOcean droplet that is shared with another project
(GradeMaster). You manage the site through **one command**,
`goblinslair-ctl`, which you run with `sudo`. That is the only thing sudo
allows for your login, and it only touches the Goblin's Lair site.

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

## Not available (ask Chris)

nginx, domains, certificates, the firewall, other users and services, and
the secrets in `/srv/goblinslair/shared/.env`. If you need a new lever (for
example "sync products now" or changing one `.env` value), ask for it to be
added to `goblinslair-ctl`, not for wider access.

## Files here

- `goblinslair-ctl`: the lever script, installed as `/usr/local/sbin/goblinslair-ctl`.
- `sudoers-goblinslair`: the one sudo rule, installed as `/etc/sudoers.d/goblinslair`.
- `install.sh`: installs both (run by Chris, as root). Re-run it after changing either file.

More about the server as a whole: `../SERVER.md`.
