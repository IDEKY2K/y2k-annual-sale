// Password screen for the whole sale site while it isn't finished (added 17 Nov 2026).
// Runs on Vercel before every request. Without the unlock cookie, visitors get a password page.
// - QR scans are still counted: when the password page is shown for a QR link or a page visit,
//   one row goes into Supabase sale_visits with referrer "(password screen)".
// - /admin (staff pricing screen, has its own passcode) and /api/geo are not blocked.
// - The hourly uptime check sends the unlock cookie, so it still checks the real pages.
// TO TURN THE PASSWORD OFF: delete this file (or set LOCKED = false) and push.
const LOCKED = true;
// SHA-256 of the password (the password itself is not stored here).
const PASS_HASH = 'e3f3a09cff25d06e03f04011c0424edfc9697915ba3b67bd1313bb9f288568d1';
const COOKIE = 'sale_gate';
const SUPABASE = 'https://xotyvlaeuyujoqrtdxiy.supabase.co/rest/v1/sale_visits';
const SB_KEY = 'sb_publishable_w6UzqtXtgJshqYwdCUpaug_NjX0KBwu';

export const config = { matcher: '/((?!api/geo|admin).*)' };

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const pass = () => new Response(null, { headers: { 'x-middleware-next': '1' } });
const getCookie = (req, name) => {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function middleware(req) {
  if (!LOCKED) return pass();
  const url = new URL(req.url);
  const token = await sha256(PASS_HASH + ':cookie-v1');

  // Password form submitted
  if (url.pathname === '/__unlock' && req.method === 'POST') {
    const form = await req.formData();
    const next = String(form.get('next') || '/');
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
    if ((await sha256(String(form.get('password') || ''))) === PASS_HASH) {
      return new Response(null, { status: 303, headers: {
        Location: safeNext,
        'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store' } });
    }
    return gate(safeNext, true);
  }

  if (getCookie(req, COOKIE) === token) return pass();

  // Count the visit (QR scans and page opens only, not images/files)
  const m = url.pathname.match(/^\/qr\/([a-z0-9-]{1,40})/i) || url.search.match(/[?&]qr=([a-z0-9-]{1,40})/i);
  const isPage = m || url.pathname === '/' || url.pathname === '/brighton-leeds' || url.pathname === '/index.html';
  if (isPage && req.method === 'GET') {
    const ua = req.headers.get('user-agent') || '';
    if (!/bot|crawl|spider|preview|curl|wget|python|deno|node-fetch|pg_net/i.test(ua)) {
      const h = (k) => { const v = req.headers.get(k); try { return v ? decodeURIComponent(v) : null; } catch { return v; } };
      try {
        await fetch(SUPABASE, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ source: m ? 'qr-' + m[1].toLowerCase() : 'direct', visitor_id: null,
            device: /iPhone|iPad/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'other',
            referrer: '(password screen)', city: h('x-vercel-ip-city'), region: h('x-vercel-ip-country-region'), country: h('x-vercel-ip-country') }) });
      } catch (e) { /* never block the page on logging */ }
    }
  }
  return gate(url.pathname + url.search, false);
}

function gate(next, wrong) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Y2K Vintage Annual Sale</title><meta name="robots" content="noindex">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#66ddfb;color:#111;font-family:Arial,Helvetica,sans-serif;padding:24px}
main{width:100%;max-width:360px;text-align:center}h1{margin:0 0 6px;font-size:30px;letter-spacing:-.06em;line-height:1}p{margin:0 0 18px;font-weight:700;letter-spacing:-.03em}
input{width:100%;font:inherit;font-size:17px;padding:12px 14px;border:2px solid #111;border-radius:12px;background:#fff;margin-bottom:10px}
button{width:100%;font:inherit;font-size:17px;font-weight:700;letter-spacing:-.04em;text-transform:uppercase;padding:12px;border:0;border-radius:12px;background:#111;color:#66ddfb;cursor:pointer}
.err{color:#b00020;margin:0 0 10px;font-weight:700}</style></head><body><main>
<h1>Y2K VINTAGE ANNUAL SALE.</h1><p>COMING SOON. 27<sup>th</sup> - 29<sup>th</sup> NOVEMBER</p>
<form method="post" action="/__unlock"><input type="hidden" name="next" value="${esc(next)}">
${wrong ? '<p class="err">Wrong password, try again.</p>' : ''}
<input type="password" name="password" placeholder="Password" autocomplete="current-password" required autofocus>
<button type="submit">Enter</button></form></main></body></html>`;
  return new Response(html, { status: wrong ? 401 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
