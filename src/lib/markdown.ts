export interface Frontmatter {
  title: string;
  date: string;
  excerpt: string;
  image?: string;
}

// Matches the exact format every hand-written file in src/content/blog/ and
// src/content/events/ already uses — quoted title/excerpt, plain date.
// `image` (events only, see admin/events.ts) is a plain unquoted value since
// it's always a URL, and is omitted entirely when absent rather than
// written as an empty string, so blog posts (which never set it) keep the
// same three-line frontmatter they've always had.
export function buildMarkdown(frontmatter: Frontmatter, body: string): string {
  const escapedTitle = frontmatter.title.replace(/"/g, '\\"');
  const escapedExcerpt = frontmatter.excerpt.replace(/"/g, '\\"');
  const lines = [
    '---',
    `title: "${escapedTitle}"`,
    `date: ${frontmatter.date}`,
    `excerpt: "${escapedExcerpt}"`,
    ...(frontmatter.image ? [`image: ${frontmatter.image}`] : []),
    '---',
    '',
    body.trim(),
  ];
  return lines.join('\n') + '\n';
}

// Just enough parsing for the admin list/edit views — not a general YAML
// parser, only handles the flat string fields this site's frontmatter uses.
export function parseFrontmatter(raw: string): Frontmatter & { body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { title: '', date: '', excerpt: '', body: raw };

  const [, frontmatterBlock, body] = match;
  const fields: Record<string, string> = {};
  for (const line of frontmatterBlock.split('\n')) {
    const eq = line.indexOf(':');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    fields[key] = value;
  }

  return {
    title: fields.title || '',
    date: fields.date || '',
    excerpt: fields.excerpt || '',
    image: fields.image || '',
    body: body.trim(),
  };
}
