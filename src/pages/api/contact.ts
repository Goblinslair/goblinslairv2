export const prerender = false;

import type { APIRoute } from 'astro';
import { loadDotEnv } from '../../lib/load-env';
import { checkRateLimit } from '../../lib/rate-limit';

loadDotEnv();

// Contact form -> an email to the shop's inbox through Brevo (same account
// and API key as the order confirmation emails). The visitor's address goes
// in Reply-To so staff can answer straight from the inbox.

const SHOP_EMAIL = 'goblinslairpj@gmail.com';
const SENDER_NAME = "Goblin's Lair website";
const TOPICS = ['General Question', 'Custom Order', 'Painting Commission', 'Table Booking'];
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Single-line fields: collapse any line breaks so nothing can end up in a
// header-like position of the email.
const oneLine = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json(400, { error: 'Invalid request.' });

  // Hidden honeypot field: real visitors never fill it in, bots usually do.
  // Pretend success so a bot learns nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') return json(200, { ok: true });

  const name = oneLine(body.name, 100);
  const email = oneLine(body.email, 200);
  const topic = TOPICS.includes(body.topic) ? body.topic : 'General Question';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 3000) : '';

  if (!name || !email || !message) {
    return json(400, { error: 'Please fill in your name, email, and message.' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return json(400, { error: 'That email address does not look right.' });
  }

  if (!(await checkRateLimit(`contact:${clientAddress}`, 5, 60))) {
    return json(429, { error: 'Too many messages from this connection. Please try again later.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('Contact form: BREVO_API_KEY not configured.');
    return json(502, { error: 'Could not send right now.' });
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SHOP_EMAIL },
        to: [{ email: SHOP_EMAIL, name: "Goblin's Lair" }],
        replyTo: { email, name },
        subject: `Website enquiry: ${topic} — ${name}`,
        htmlContent:
          `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) sent a message via the website.</p>` +
          `<p><strong>Topic:</strong> ${escapeHtml(topic)}</p>` +
          `<p style="white-space:pre-wrap;border-left:3px solid #a67c3d;padding-left:12px;">${escapeHtml(message)}</p>` +
          `<p style="color:#888;font-size:12px;">Reply to this email to answer ${escapeHtml(name)} directly.</p>`,
        textContent: `${name} (${email}) sent a message via the website.\nTopic: ${topic}\n\n${message}\n\nReply to this email to answer them directly.`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('Contact form: Brevo send failed', res.status, detail);
      return json(502, { error: 'Could not send right now.' });
    }
    return json(200, { ok: true });
  } catch (err) {
    console.error('Contact form: Brevo send threw', err);
    return json(502, { error: 'Could not send right now.' });
  }
};
