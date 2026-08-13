import type { APIRoute } from 'astro';

// A plain public/robots.txt can't read Astro.site, and the Sitemap: line
// needs an absolute URL, so this is a tiny endpoint instead of a static file.
export const GET: APIRoute = ({ site }) => {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
