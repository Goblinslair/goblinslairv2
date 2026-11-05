# Server setup (DigitalOcean droplet)

How the Goblin's Lair site is hosted on the droplet as of **2026-11-04**,
plus what a future AI agent (or person) needs to know before touching it.
No secrets are written here: values live only on the server.

> **Note:** `CLAUDE.md` is partly out of date on this branch. It still
> describes JSON product files, the GitHub Action and the GitHub-backed admin.
> On `krispy`, products, blog posts and events live in Postgres. Trust this
> file and the code over `CLAUDE.md` for hosting details.

## Ground rules for agents

- **Ask before every server change.** That includes SSH, nginx, firewall,
  users, keys, certificates, `.env` edits and deploys. Confirm right before
  running it, even if it was agreed earlier. Read-only checks are fine.
- **The droplet is shared with GradeMaster** (a separate project with its own
  services and nginx site). Only touch `/srv/goblinslair`, the `goblinslair`
  service and the `goblinslair*` nginx sites unless asked.
- **Never type or print secrets** (the admin password, `.env` values, private
  keys). Move key files with `scp` without opening them.
- **Keep `krispy` off `main`** until the full cutover. Vercel (on `main`)
  has no hourly product sync any more, so its catalog would go stale.

## The machine

| Item | Value |
|---|---|
| Provider | DigitalOcean droplet, NYC3, 2 vCPU / 2 GB RAM, 2 GB swap |
| IP | `159.65.171.134` |
| OS | Ubuntu 24.04 LTS, nginx 1.24, Node 24 |
| Firewall | ufw: OpenSSH, 80/tcp, 443/tcp only |
| SSH | Keys only. `PasswordAuthentication no`, root is `prohibit-password` |

### Users

| User | Purpose | Login |
|---|---|---|
| `root` | Admin and deploys | Key `~/.ssh/grademaster_vps` on Chris's Mac |
| `goblins` | Runs the site service. Home is `/srv/goblinslair` | No (`nologin`) |
| `goblinstarv` | The shop owner (Chris's friend). Added 2026-11-04 | Yes, his own key (`goblinslair-2026-11-04`). Sudo for `goblinslair-ctl` only. Cannot read `shared/.env` directly |
| `grademaster`, `ubuntu` | GradeMaster / DO default | Not ours |

`goblinstarv` deploys and manages the site through the levers in
`deployment/` (see "Deploying" below), not through general sudo. Add new
abilities as new `goblinslair-ctl` commands, not wider access. There is one
copy of the site, deployed with `deploy.sh`, not a second copy run by
someone else. Code he deploys runs as `goblins`, so it can read
`shared/.env`. That is accepted.

## How a request reaches the site

```
visitor -> Cloudflare (proxy) -> nginx :443 on droplet -> Node on 127.0.0.1:4321
```

### Domains and Cloudflare

| Hostname | Cloudflare account | SSL mode | Origin cert on droplet |
|---|---|---|---|
| `goblinslair.com.my` (+ `www`) | Shop owner's account (Chris has super admin) | Full (strict) | `/etc/ssl/goblinslair-commy-origin.pem` + `/etc/ssl/private/goblinslair-commy-origin.key`, covers `goblinslair.com.my` and `*.goblinslair.com.my`, to 2041 |
| `goblinslair.coreka.co` | Chris's account (coreka.co zone) | Full (strict) | `/etc/ssl/goblinslair-origin.pem` + key. **Revoked 2026-11-04, see Known issues** |
| `grademaster.coreka.co` | Chris's account | Full | `/etc/ssl/grademaster-origin.pem` + key, to 2041 |

All certificates are **Cloudflare Origin Certificates**. Only Cloudflare
trusts them, so the hostnames must stay proxied (orange cloud). To make one:
the zone's SSL/TLS, then Origin Server, then Create Certificate, PEM format.
Save both boxes to files and `scp` them up. Cloudflare shows the key only once.
Revoking a certificate in that list breaks the site using it straight away
(Cloudflare returns 526).

`goblinslair.com.my` is the real domain. `goblinslair.coreka.co` was the
test address before the domain was ready.

### nginx

Sites live in `/etc/nginx/sites-enabled/`:

- `00-default`: catch-all. Refuses unknown hostnames on 80 and 443
  (`ssl_reject_handshake`). Any site that Cloudflare reaches over HTTPS
  therefore **must** have its own `listen 443 ssl` block, or it gets 525.
- `goblinslair`: `goblinslair.coreka.co`, proxies to `127.0.0.1:4321`.
- `goblinslair-commy`: `goblinslair.com.my`, proxies to `127.0.0.1:4321`,
  and a small block sending `www` to the bare domain (301).
- `grademaster`: GradeMaster (static files + API on `127.0.0.1:8000`).

Both Goblin's Lair blocks include `snippets/cloudflare-realip.conf` (the real
visitor IP, trusted only from Cloudflare's IP ranges, fetched 2026-11-03).
Refresh that list from cloudflare.com/ips now and then. The login and signup
rate limits count by this IP. `client_max_body_size 5m` allows admin image
uploads.

After any nginx change: `nginx -t && systemctl reload nginx`. Back up the
file first, somewhere **outside** `sites-enabled` (nginx loads every file
there). Existing backups are in `/root/*.bak-20261104`.

### The app

- systemd unit `goblinslair` (`/etc/systemd/system/goblinslair.service`), runs
  as `goblins`, `ExecStart=/usr/bin/node dist/server/entry.mjs`,
  `HOST=127.0.0.1`, `PORT=4321`, `Restart=on-failure`.
- Secrets: `/srv/goblinslair/shared/.env` (owner `goblins`, mode 600), loaded
  through `EnvironmentFile`. The keys are `LOYVERSE_*`, `DATABASE_URL` (Neon),
  `ADMIN_PASSWORD_HASH`, `FIUU_*` (including `FIUU_SANDBOX`), `BREVO_API_KEY`
  and `SITE_URL=https://goblinslair.com.my`. `GITHUB_TOKEN`/`GITHUB_REPO`
  are left over and no longer used. `SYNC_SECRET` is **not** set yet.
- Logs: `journalctl -u goblinslair`.
- The database is Neon Postgres (off the droplet, free tier). Products, blog
  posts, events, customers, carts and orders are all there.

## Deploying

Run on `krispy`, with a clean working tree that is not behind
`origin/krispy`:

```bash
# Chris (as root)
GOBLINS_SITE_URL=https://goblinslair.com.my ./deploy.sh
# The shop owner (as goblinstarv)
GOBLINS_USER=goblinstarv GOBLINS_SITE_URL=https://goblinslair.com.my ./deploy.sh
```

The script:

1. Builds locally with `DEPLOY_TARGET=node` (Node adapter, output in `dist/`).
2. Uploads to `/srv/goblinslair/deployment/<time>-<sha>/` with rsync.
3. Runs `goblinslair-ctl deploy <release>` on the droplet (with `sudo -n`
   for non-root users). That script moves the upload into `releases/`, runs
   `npm ci --omit=dev` as `goblins` (so `sharp` gets its Linux binary),
   points `current` at it, restarts the service and checks the home page.
4. If the home page does not return 200, it switches back to the previous
   release and deletes the failed one. It keeps the newest 3 releases, never
   deletes the live one, and deletes uploads that were never deployed after 24
   hours. A lock stops two deploys from running at once.

Release names use **UTC** time, and `deploy` refuses any other. Rollback
picks releases by name order, so a local-time name once made it roll back to
the wrong release.

The levers (`status`, `releases`, `logs`, `restart`, `deploy`, `rollback`,
`switch`)
live in `deployment/goblinslair-ctl`, installed at
`/usr/local/sbin/goblinslair-ctl`. The only sudo rule is
`/etc/sudoers.d/goblinslair`. `deployment/install.sh` (run as root from the
Mac) installs or updates both, makes `releases/` root-owned and creates the
upload folder. Every lever use is logged to `/var/log/goblinslair-ctl.log`.
See `deployment/README.md` for the shop owner's guide.

`SITE_URL` is **baked in at build time**. It sets the canonical links,
sitemap, social tags, FIUU return/webhook URLs and `security.allowedDomains`.
Changing the domain means rebuilding, not just editing `.env`.

Rollback: `sudo goblinslair-ctl rollback` (moves to the release before the
live one).

**Live now:** release `20261104161711-752c208` (krispy `752c208`, deployed 2026-11-04 through the levers).

## Known issues and open items (2026-11-04)

1. **`goblinslair.coreka.co` returns Cloudflare 526.** Its origin certificate
   (serial `38B19EBF...C119`) was revoked on 2026-11-04 at 08:41 UTC, at the
   same time the GradeMaster certificate was made. Fix: make a new origin
   certificate for `goblinslair.coreka.co`, or better, redirect that hostname
   to `goblinslair.com.my` (which still needs a valid certificate).
2. **Plain HTTP is not redirected** on `goblinslair.com.my`. Turn on Always
   Use HTTPS in the shop owner's Cloudflare zone.
3. **The client IP is only trusted for `goblinslair.com.my`** (`allowedDomains`
   comes from `SITE_URL`). On any other hostname, every visitor shares one
   rate-limit bucket. Another reason to redirect coreka.co.
4. **Untested on krispy:** admin save/edit/delete for blog posts and events
   (needs the real admin password, so Chris tests it) and a full FIUU sandbox
   checkout. Check what `FIUU_SANDBOX` is set to before real customers use
   the site.
5. **The FIUU merchant portal** may need `goblinslair.com.my` added as an
   allowed domain or return URL.
6. **The page title shows `&amp;amp;`.** Something escapes it twice.
7. **No hourly product sync on the droplet yet.** Planned: a systemd timer
   calling `POST /api/admin/sync-products` with `Bearer SYNC_SECRET` (add
   `SYNC_SECRET` to `shared/.env` first). Until then, use the admin's "Sync
   Products Now" button. Live stock is read from Loyverse on each request
   anyway.
8. **Remaining migration phases** (images off Vercel Blob onto the droplet,
   simple admin, removing the Vercel adapter, final cutover and turning off
   Vercel). See the project memory notes on the droplet/DB migration.
9. **GradeMaster** (not this project): its login check is a fixed cookie
   value in its nginx config. It was also down (525) from 2026-11-03 05:36
   UTC to 2026-11-04, until it got its own 443 block. Check the eBay developer
   portal for its account-deletion endpoint.

## Quick checks

```bash
# From anywhere
curl -s -o /dev/null -w "%{http_code}\n" https://goblinslair.com.my/
curl -s https://goblinslair.com.my/ | grep -o '<link rel="canonical"[^>]*>'

# On the droplet (as root)
systemctl status goblinslair
journalctl -u goblinslair -n 50 --no-pager
readlink /srv/goblinslair/current
curl -sk --resolve goblinslair.com.my:443:127.0.0.1 -o /dev/null -w "%{http_code}\n" https://goblinslair.com.my/
```
