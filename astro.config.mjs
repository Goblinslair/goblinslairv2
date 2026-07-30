import { defineConfig } from 'astro/config';

// output: 'static' (the default) means `npm run build` produces a plain
// dist/ folder of HTML, CSS, and JS — no server/adapter required.
// That folder can be deployed to Vercel, or uploaded as-is to any
// traditional web host later on.
export default defineConfig({
  output: 'static',
});
