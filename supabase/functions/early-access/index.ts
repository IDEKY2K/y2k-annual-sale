// Annual sale "Want early access?" sign-ups (added 17 Nov 2026).
// The sign-up page at sale.y2kxvintage.com/early-access posts here. This function:
//  1. saves the sign-up into Supabase table early_access_signups (one row per email address),
//  2. sends the confirmation email from hello@y2kxvintage.com through Microsoft Graph,
//     using its own Microsoft app (secrets HELLO_MS_TENANT_ID / HELLO_MS_CLIENT_ID / HELLO_MS_CLIENT_SECRET),
//     falling back to Britney Bot's app (MS_*) if those aren't set.
// Britney Bot's own functions are not touched.
// Protection against misuse: hidden "website" honeypot field, max 5 sign-ups per hour per connection,
// and an email address only ever gets the confirmation once.
// {preview:true} returns the email HTML without saving or sending.
import { createClient } from "npm:@supabase/supabase-js@2";

const FROM = "hello@y2kxvintage.com";
const env = (k: string) => Deno.env.get(k) || "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const STORES = ["Brick Lane Mens & Womens", "Notting Hill"];
const ALLOWED_ORIGINS = [/^https:\/\/sale\.y2kxvintage\.com$/, /^https:\/\/y2k-annual-sale[a-z0-9-]*\.vercel\.app$/];

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.some((r) => r.test(origin)) ? origin : "https://sale.y2kxvintage.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  Vary: "Origin",
});
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const clean = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---- The email. Wording is exactly as Sameer wrote it (17 Nov). Style follows sale.y2kxvintage.com:
// aqua background, black Arial bold, white bubbles. Colours are locked against email-app dark mode. No photos (user, 17 Nov). Email-safe: tables + inline styles.
const AQUA = "#00e0ff", INK = "#111111";
function email() {
  const subject = "You’re on the list! Y2K Vintage Early Access Sip ’n’ Shop";
  const p = (t: string, extra = "") => `<p style="margin:0 0 14px;font-size:16px;line-height:1.45;font-weight:700;letter-spacing:-0.3px;color:${INK}${extra}">${t}</p>`;
  const store = (name: string, addr: string) =>
    `<td width="50%" style="padding:6px;vertical-align:top"><div class="bubble" style="background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border-radius:14px;padding:14px 14px 12px">
<div style="font-size:18px;font-weight:700;letter-spacing:-0.6px;color:${INK};text-transform:uppercase">${name}</div>
<div style="font-size:14px;font-weight:700;letter-spacing:-0.2px;color:${INK};margin-top:4px;line-height:1.35">${addr}</div></div></td>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${esc(subject)}</title>
<style>
:root{color-scheme:light only;supported-color-schemes:light only}
/* Outlook (web, new Outlook, Mac) dark mode: put our colours back */
[data-ogsb] .bg{background-color:${AQUA}!important}
[data-ogsb] .bubble{background-color:#ffffff!important}
[data-ogsc] .ink,[data-ogsc] .ink *{color:${INK}!important}
/* Apple Mail / iOS dark mode */
@media (prefers-color-scheme: dark){
 .bg{background-color:${AQUA}!important}
 .bubble{background-color:#ffffff!important}
 .ink,.ink *{color:${INK}!important}
}
</style></head>
<body class="bg" style="margin:0;padding:0;background-color:${AQUA};background-image:linear-gradient(${AQUA},${AQUA})">
<div style="display:none;max-height:0;overflow:hidden">Annual Sale Early Access Sip n Shop this Thursday 6:30pm.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" bgcolor="${AQUA}" style="background-color:${AQUA};background-image:linear-gradient(${AQUA},${AQUA})"><tr><td align="center" style="padding:28px 14px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ink" style="max-width:560px;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<tr><td style="padding:0 6px">
<div style="font-size:34px;line-height:1;font-weight:700;letter-spacing:-2px;color:${INK}">YOU’RE ON THE LIST!</div>
<div style="font-size:17px;line-height:1.1;font-weight:700;letter-spacing:-0.8px;color:${INK};margin:10px 0 22px">Y2K VINTAGE ANNUAL SALE &nbsp;★&nbsp; EARLY ACCESS SIP ’N’ SHOP</div>
${p("Hey,")}
${p("Thanks for RSVPing! You’re on the list for our Annual Sale Early Access Sip n Shop this Thursday 6:30pm.")}
${p("Come have a sip and shop the sale before it opens to everyone. All vintage is £5–£30, and you’ll get an extra 15% off those prices on the night.")}
</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
${store("Brick Lane", "214 Brick Lane,<br>London E1 6SA")}
${store("Notting Hill", "217 Portobello Road,<br>London W11 1LU")}
</tr></table></td></tr>
<tr><td style="padding:18px 6px 0">
${p("See you Thursday!")}
${p("Y2K Vintage x", ";margin-bottom:26px")}
<div style="font-size:13px;font-weight:700;letter-spacing:-0.2px;color:${INK};text-align:center">@Y2KXVINTAGE</div>
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

// Uses the hello@ Microsoft app (HELLO_MS_* secrets) when they are set, otherwise Britney Bot's app (MS_*).
const ms = (k: string) => env("HELLO_MS_" + k) || env("MS_" + k);
async function graphToken() {
  const r = await fetch(`https://login.microsoftonline.com/${ms("TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: ms("CLIENT_ID"), client_secret: ms("CLIENT_SECRET"), grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Microsoft sign-in failed: " + (j.error_description || j.error || r.status));
  return j.access_token as string;
}
async function send(to: string, name: string, m: { subject: string; html: string }) {
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${FROM}/sendMail`, {
    method: "POST", headers: { Authorization: "Bearer " + (await graphToken()), "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: m.subject, body: { contentType: "HTML", content: m.html },
      toRecipients: [{ emailAddress: { address: to, name: name || undefined } }] }, saveToSentItems: true }),
  });
  if (!r.ok) throw new Error(`Send failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const H = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  const json = (o: unknown, status = 200) => Response.json(o, { status, headers: H });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  const b = await req.json().catch(() => ({} as any));

  if (b.preview) {
    const m = email();
    return new Response(m.html, { headers: { ...H, "Content-Type": "text/html; charset=utf-8" } });
  }

  // Honeypot: real people never fill the hidden "website" field. Pretend success.
  if (clean(b.website)) return json({ ok: true });

  const first = clean(b.first_name, 60), last = clean(b.last_name, 60);
  const mail = clean(b.email, 160).toLowerCase(), phone = clean(b.phone, 30);
  const store = STORES.includes(clean(b.store)) ? clean(b.store) : null;
  if (!first) return json({ ok: false, error: "Please enter your first name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return json({ ok: false, error: "Please enter a valid email address." }, 400);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const ipHash = ip ? (await sha256("early-access:" + ip)).slice(0, 32) : null;
  if (ipHash) {
    const since = new Date(Date.now() - 3600e3).toISOString();
    const c = await db.from("early_access_signups").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
    if ((c.count || 0) >= 5) return json({ ok: false, error: "Too many sign-ups from this connection. Please try again later." }, 429);
  }

  // One row per email. A repeat sign-up updates the details but doesn't send a second email.
  const existing = await db.from("early_access_signups").select("id,email_status").ilike("email", mail).maybeSingle();
  const row = { first_name: first, last_name: last || null, email: mail, phone: phone || null, store,
    marketing_consent: !!b.marketing_consent, source: clean(b.source, 60) || null, ip_hash: ipHash,
    user_agent: clean(req.headers.get("user-agent"), 200) || null };
  let id: string;
  if (existing.data) {
    id = existing.data.id;
    await db.from("early_access_signups").update(row).eq("id", id);
    if (existing.data.email_status === "sent") return json({ ok: true, already: true });
  } else {
    const ins = await db.from("early_access_signups").insert(row).select("id").single();
    if (ins.error) return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
    id = ins.data.id;
  }

  try {
    await send(mail, [first, last].filter(Boolean).join(" "), email());
    await db.from("early_access_signups").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null }).eq("id", id);
  } catch (e) {
    // The sign-up is still saved; the email can be re-sent later.
    await db.from("early_access_signups").update({ email_status: "failed", email_error: (e instanceof Error ? e.message : String(e)).slice(0, 500) }).eq("id", id);
  }
  return json({ ok: true });
});
