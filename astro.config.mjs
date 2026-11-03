import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';

// No production domain assigned yet - set SITE_URL in Vercel's env vars once
// one is. Everything below (canonical tags, OG/Twitter meta, LocalBusiness
// schema, src/pages/sitemap.xml.ts) reads Astro.site, so this is the one
// line to fix.
const site = process.env.SITE_URL || 'https://example.com';

// Two hosts, picked at build time. A plain `npm run build` (what Vercel runs)
// keeps the Vercel adapter, so production is untouched. `deploy.sh` builds
// with DEPLOY_TARGET=node for the DigitalOcean droplet, where a standalone
// Node server sits behind nginx (and Cloudflare in front of that).
const isNode = process.env.DEPLOY_TARGET === 'node';

// Behind a proxy, every request reaches Node from 127.0.0.1, so
// `clientAddress` (the key the login/signup rate limits count by) would put
// every visitor in one shared bucket. Astro only trusts X-Forwarded-For for
// hostnames listed here, so name the site's own. nginx overwrites that header
// with the real visitor IP, and only believes Cloudflare's address ranges
// when doing so — see the droplet's nginx block for this site.
const allowedDomains = isNode ? [{ hostname: new URL(site).hostname }] : [];

// output: 'static' by default — most pages still build to plain HTML/CSS/JS
// with no server involved. Individual routes can opt into server rendering
// with `export const prerender = false` (used by the product item page,
// which renders per-request from live-synced product data instead of
// pre-building one HTML file per product).
export default defineConfig({
  output: 'static',
  adapter: isNode ? node({ mode: 'standalone' }) : vercel(),
  site,
  // Astro's default CSRF check (security.checkOrigin) rejects any
  // form-content-type POST (x-www-form-urlencoded/multipart/text-plain)
  // whose Origin header doesn't match this site — and it's global-only,
  // with no per-route exception. Every other POST route here already
  // avoids relying on it by using JSON bodies instead (see the comment on
  // src/pages/api/admin/upload.ts), so this protection currently defends
  // nothing that isn't already covered another way. It has to be off,
  // though, because FIUU's payment webhook (src/pages/api/checkout/
  // fiuu-webhook.ts) is required by FIUU's own spec to POST
  // x-www-form-urlencoded from their servers — a third party can never
  // send a matching Origin, so leaving this on would 403 every real
  // payment confirmation, permanently and silently.
  security: {
    checkOrigin: false,
    allowedDomains,
  },
  // sharp ships a native .node binary (used by src/pages/api/admin/upload.ts)
  // that the server bundler can't inline — keep it external so Vercel's file
  // tracer (or, on the droplet, `npm ci` there) picks up the real platform
  // binary instead of a broken bundled stub.
  vite: {
    ssr: {
      external: ['sharp'],
    },
  },
});
