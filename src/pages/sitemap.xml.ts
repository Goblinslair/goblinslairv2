export const prerender = false;

import type { APIRoute } from 'astro';
import { getAllProducts } from '../lib/products';
import { listPosts } from '../lib/content';
import { SHOW_BLOG_AND_EVENTS } from '../lib/site-config';

// Built per request rather than by @astrojs/sitemap at build time: products
// and blog posts live in the database now, so a build can't see them. Lists the public
// pages only (no login/cart/account/admin).
const STATIC_PATHS = ['/', '/about', '/products', ...(SHOW_BLOG_AND_EVENTS ? ['/blog'] : []), '/contact', '/terms'];

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const GET: APIRoute = async ({ site }) => {
  const [posts, products] = await Promise.all([SHOW_BLOG_AND_EVENTS ? listPosts() : Promise.resolve([]), getAllProducts()]);

  const paths = [
    ...STATIC_PATHS,
    ...posts.map((post) => `/blog/${post.id}`),
    ...products.map((product) => `/products/${product.id}`),
  ];

  const urls = paths.map((p) => `  <url><loc>${escapeXml(new URL(p, site).href)}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
