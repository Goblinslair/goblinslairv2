export const prerender = false;

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getAllProducts } from '../lib/products';

// Built per request rather than by @astrojs/sitemap at build time: products
// live in the database now, so a build can't see them. Lists the public
// pages only (no login/cart/account/admin).
const STATIC_PATHS = ['/', '/about', '/products', '/blog', '/contact', '/terms'];
const BLOG_PAGE_SIZE = 9; // matches paginate() in src/pages/blog/[...page].astro

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const GET: APIRoute = async ({ site }) => {
  const [posts, products] = await Promise.all([getCollection('blog'), getAllProducts()]);
  const blogPages = Math.ceil(posts.length / BLOG_PAGE_SIZE);

  const paths = [
    ...STATIC_PATHS,
    ...Array.from({ length: Math.max(0, blogPages - 1) }, (_, i) => `/blog/${i + 2}`),
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
