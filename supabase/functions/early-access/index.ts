// Annual sale "Want early access?" sign-ups (added 17 Nov 2026).
// Sign-ups arrive from the Fillout form 9FDRy1w2KWus (webhook, 19 Nov) or the page sale.y2kxvintage.com/early-access. This function:
//  1. saves the sign-up into Supabase table early_access_signups (one row per email address),
//  2. sends the confirmation email from hello@y2kxvintage.com through Microsoft Graph,
//     using its own Microsoft app (secrets HELLO_MS_TENANT_ID / HELLO_MS_CLIENT_ID / HELLO_MS_CLIENT_SECRET),
//     falling back to Britney Bot's app (MS_*) if those aren't set.
// Britney Bot's own functions are not touched.
// Protection against misuse: hidden "website" honeypot field, max 5 sign-ups per hour per connection,
// and an email address only ever gets the confirmation once.
// {preview:true, store?} returns the email HTML without saving or sending.
// The email shows only the address of the store the person picked.
import { createClient } from "npm:@supabase/supabase-js@2";

const FROM = "hello@y2kxvintage.com";
const env = (k: string) => Deno.env.get(k) || "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
// Three stores (19 Nov). "Brick Lane Mens & Womens" is the old combined option: those sign-ups get BOTH Brick Lane addresses.
const STORES = ["Brick Lane Womens", "Brick Lane Mens", "Notting Hill", "Brick Lane Mens & Womens"];
// PAUSE switch. Was live 19 Nov 14:50-15:08; PAUSED 19 Nov 15:08 (user: email looks bad in Gmail).
// While paused, only test addresses get the email: this list plus any row in early_access_signups marked is_test.
// Everyone else is saved as "held" (send them once un-paused). Set PAUSED to false to go live.
const PAUSED = true;
const TEST_ONLY: string[] = ["sameer@y2kwholesale.com"];
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

// ---- The email. Wording is exactly as Sameer wrote it (17 Nov, 15:55 version). Style follows sale.y2kxvintage.com:
// aqua background, black Arial bold, white bubbles. Colours are locked against email-app dark mode. No photos, all text in capitals (user, 17 Nov). Email-safe: tables + inline styles.
const AQUA = "#00e0ff", INK = "#111111";
function email(chosen?: string | null) {
  const subject = "You’re on the list! Y2K Vintage Annual Sale Early Access";
  // Only the store(s) they signed up for. (All three are shown only if no store was given.)
  const BLW: [string, string] = ["Brick Lane Womens", "214 Brick Lane,<br>London E1 6SA"];
  const BLM: [string, string] = ["Brick Lane Mens", "216 Brick Lane,<br>London E1 6SA"];
  const NH: [string, string] = ["Notting Hill", "217 Portobello Road,<br>London W11 1LU"];
  const ADDR: Record<string, [string, string][]> = {
    "Brick Lane Womens": [BLW],
    "Brick Lane Mens": [BLM],
    "Notting Hill": [NH],
    "Brick Lane Mens & Womens": [BLW, BLM], // old combined option (backlog): both Brick Lane stores
  };
  const p = (t: string, extra = "") => `<p style="margin:0 0 14px;font-size:16px;line-height:1.45;font-weight:700;letter-spacing:-0.3px;color:${INK}${extra}">${t.toUpperCase()}</p>`;
  const store = (name: string, addr: string, full = false) =>
    `<td width="${full ? "100%" : "50%"}" style="padding:6px;vertical-align:top"><div class="bubble" style="background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border-radius:14px;padding:14px 14px 12px">
<div style="font-size:18px;font-weight:700;letter-spacing:-0.6px;color:${INK};text-transform:uppercase">${name.toUpperCase()}</div>
<div style="font-size:14px;font-weight:700;letter-spacing:-0.2px;color:${INK};margin-top:4px;line-height:1.35">${addr.toUpperCase().replace(/<BR>/g, "<br>")}</div></div></td>`;
  const pick = chosen && ADDR[chosen] ? ADDR[chosen] : [BLW, BLM, NH];
  const bubbles = pick.map(([n, a], i) => (i && i % 2 === 0 ? "</tr><tr>" : "") + store(n, a, pick.length === 1)).join("\n");
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
<div style="display:none;max-height:0;overflow:hidden">LONDON ANNUAL SALE EARLY ACCESS EVENT, THURSDAY 26TH NOVEMBER AT 6:30PM.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" bgcolor="${AQUA}" style="background-color:${AQUA};background-image:linear-gradient(${AQUA},${AQUA})"><tr><td align="center" style="padding:28px 14px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ink" style="max-width:560px;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<tr><td style="padding:0 6px">
<div style="font-size:34px;line-height:1;font-weight:700;letter-spacing:-2px;color:${INK}">YOU’RE ON THE LIST!</div>
<div style="font-size:17px;line-height:1.1;font-weight:700;letter-spacing:-0.8px;color:${INK};margin:10px 0 22px">Y2K VINTAGE &nbsp;★&nbsp; LONDON ANNUAL SALE EARLY ACCESS EVENT</div>
${p("Hey,")}
${p("Thanks for RSVPing! You’re on the list for our London Annual Sale Early Access Event on Thursday 26th November at 6:30pm.")}
${p("Shop the sale before it opens to everyone. All vintage is £5–£30, and you’ll get an extra 15% off those prices on the night.")}
</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
${bubbles}
</tr></table></td></tr>
<tr><td style="padding:18px 6px 0">
${p("See you on the 26th!")}
${p("Y2K Vintage ★", ";margin-bottom:26px")}
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
// Microsoft only lets a few emails send from one mailbox at the same moment (429 "MailboxConcurrency"),
// so a busy moment is retried up to 5 times with a growing pause before the email is marked failed.
async function send(to: string, name: string, m: { subject: string; html: string }) {
  const token = await graphToken();
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${FROM}/sendMail`, {
      method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject: m.subject, body: { contentType: "HTML", content: m.html },
        toRecipients: [{ emailAddress: { address: to, name: name || undefined } }] }, saveToSentItems: true }),
    });
    if (r.ok) return;
    if ((r.status === 429 || r.status === 503) && attempt < 5) {
      const wait = Number(r.headers.get("retry-after")) || 0;
      await new Promise((ok) => setTimeout(ok, Math.max(wait * 1000, (attempt + 1) * 1500 + Math.random() * 1000)));
      continue;
    }
    throw new Error(`Send failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
  }
}

// Reads a Fillout submission. Only these exact store answers count as an annual sale early access sign-up
// (apostrophes and capitals ignored), so the form's other event RSVPs (e.g. "Y2K Vintage Brick Lane") never get this email.
// "Brick Lane Mens & Womens" is the old combined option: those people get both Brick Lane addresses.
const FILLOUT_STORES: Record<string, string> = {
  "brick lane mens & womens": "Brick Lane Mens & Womens",
  "brick lane womens": "Brick Lane Womens",
  "brick lane mens": "Brick Lane Mens",
  "notting hill": "Notting Hill",
};
function storeFrom(v: string): string | null {
  return FILLOUT_STORES[v.toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim()] || null;
}
// Turns any webhook body (Fillout form webhook or Zite database record.created webhook) into [name, value] pairs.
// Handles {questions:[{name,value}]}, {fields:{Name:value}} and nested objects, whatever the exact shape.
function pairs(o: unknown, key = "", out: [string, unknown][] = []) {
  if (o && typeof o === "object" && !Array.isArray(o)) {
    const r = o as Record<string, unknown>;
    if ("value" in r && (typeof r.name === "string" || typeof r.label === "string")) out.push([String(r.name ?? r.label), r.value]);
    else for (const [k, v] of Object.entries(r)) pairs(v, k, out);
  } else if (Array.isArray(o)) {
    if (o.every((x) => typeof x !== "object" || x === null)) out.push([key, o]);
    else for (const x of o) pairs(x, key, out);
  } else out.push([key, o]);
  return out;
}
function webhookFields(body: unknown) {
  const out: Record<string, unknown> = {};
  for (const [name, v] of pairs(body)) {
    const n = name.toLowerCase();
    const sv = Array.isArray(v) ? v.join(" ") : typeof v === "string" ? v : "";
    if (n.includes("plus") || n.includes("+1")) continue; // the guest's plus-one, not the guest
    if (!out.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(sv.trim()) && !n.includes("by")) out.email = sv;
    else if (!out.first_name && n.includes("first")) out.first_name = sv;
    else if (!out.last_name && n.includes("last") && !n.includes("update")) out.last_name = sv;
    else if (!out.phone && n.includes("phone")) out.phone = sv;
    else if (n.includes("consent") || n.includes("marketing")) out.marketing_consent = v === true || /^(yes|true)$/i.test(sv);
    if (!out.store && sv && storeFrom(sv)) out.store = storeFrom(sv);
  }
  return out;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const H = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  const json = (o: unknown, status = 200) => Response.json(o, { status, headers: H });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  const b = await req.json().catch(() => ({} as any));

  if (b.preview) {
    const m = email(b.store ? clean(b.store) : null);
    return new Response(m.html, { headers: { ...H, "Content-Type": "text/html; charset=utf-8" } });
  }

  // Webhook from Fillout/Zite (the user's form 9FDRy1w2KWus saves into Zite table "AW26 RSVPs"; the user added a
  // record.created webhook there, 19 Nov). Anything that isn't our own page or a preview is treated as a webhook.
  // Every webhook body is logged in early_access_webhook_log so its exact shape can be checked.
  const fromFillout = !(b && typeof b.email === "string" && "first_name" in b);
  if (fromFillout) {
    const f = webhookFields(b);
    const skip = !f.store ? "not an annual sale early access sign-up" : !f.email ? "no email address found" : "";
    await db.from("early_access_webhook_log").insert({ payload: b, result: skip || "accepted: " + f.store });
    if (skip) return json({ ok: true, skipped: skip });
    Object.assign(b, f, { source: "fillout" });
    if (!clean(b.first_name)) b.first_name = "-"; // the email never shows the name, so a missing name doesn't block it
  }

  // Honeypot: real people never fill the hidden "website" field. Pretend success.
  if (!fromFillout && clean(b.website)) return json({ ok: true });

  const first = clean(b.first_name, 60), last = clean(b.last_name, 60);
  const mail = clean(b.email, 160).toLowerCase(), phone = clean(b.phone, 30);
  const store = STORES.includes(clean(b.store)) ? clean(b.store) : null;
  if (!first) return json({ ok: false, error: "Please enter your first name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return json({ ok: false, error: "Please enter a valid email address." }, 400);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const ipHash = ip ? (await sha256("early-access:" + ip)).slice(0, 32) : null;
  if (ipHash && !fromFillout) { // Fillout's servers send every webhook, so the per-connection limit doesn't apply to them
    const since = new Date(Date.now() - 3600e3).toISOString();
    const c = await db.from("early_access_signups").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
    if ((c.count || 0) >= 5) return json({ ok: false, error: "Too many sign-ups from this connection. Please try again later." }, 429);
  }

  // One row per email. A repeat sign-up updates the details but doesn't send a second email.
  const existing = await db.from("early_access_signups").select("id,email_status,is_test").ilike("email", mail).maybeSingle();
  const isTest = TEST_ONLY.includes(mail) || !!existing.data?.is_test;
  const row = { first_name: first, last_name: last || null, email: mail, phone: phone || null, store,
    marketing_consent: !!b.marketing_consent, source: clean(b.source, 60) || null, ip_hash: ipHash,
    user_agent: clean(req.headers.get("user-agent"), 200) || null };
  let id: string;
  if (existing.data) {
    id = existing.data.id;
    await db.from("early_access_signups").update(row).eq("id", id);
    if (existing.data.email_status === "sent" && !isTest) return json({ ok: true, already: true });
  } else {
    const ins = await db.from("early_access_signups").insert(row).select("id").single();
    if (ins.error) return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
    id = ins.data.id;
  }

  if (PAUSED && !isTest) {
    await db.from("early_access_signups").update({ email_status: "held" }).eq("id", id);
    return json({ ok: true });
  }
  try {
    await send(mail, [first, last].filter(Boolean).join(" "), email(store));
    await db.from("early_access_signups").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null }).eq("id", id);
  } catch (e) {
    // The sign-up is still saved; the email can be re-sent later.
    await db.from("early_access_signups").update({ email_status: "failed", email_error: (e instanceof Error ? e.message : String(e)).slice(0, 500) }).eq("id", id);
  }
  return json({ ok: true });
});
