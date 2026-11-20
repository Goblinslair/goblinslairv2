import type { APIRoute } from 'astro';

// A plain public/robots.txt can't read Astro.site, and the Sitemap: line
// needs an absolute URL, so this is a tiny endpoint instead of a static file.
// Login, signup, cart and account stay crawlable on purpose: they carry a
// noindex tag, and Google can only obey it if it is allowed to read the page.
export const GET: APIRoute = ({ site }) => {
  const body = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /checkout/\n\nSitemap: ${new URL('sitemap.xml', site).href}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
