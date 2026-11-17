// Saves sale prices and the slideshow on/off switch for /admin.
// Only reachable after the sale site password: middleware.js blocks /api/admin without the unlock cookie.
// It calls the Supabase functions with a key derived from the site password hash; Supabase stores only a hash of that key.
const crypto = require('crypto');
const PASS_HASH = 'e3f3a09cff25d06e03f04011c0424edfc9697915ba3b67bd1313bb9f288568d1'; // same as middleware.js
const SB = 'https://xotyvlaeuyujoqrtdxiy.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable_w6UzqtXtgJshqYwdCUpaug_NjX0KBwu';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const staffKey = crypto.createHash('sha256').update(PASS_HASH + ':cookie-v1').digest('hex');
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  let fn, args;
  if (b.action === 'price') {
    fn = 'sale_save_price';
    args = { p: staffKey, p_photo: b.photo, p_old: b.old_price ?? null, p_new: b.new_price ?? null, p_by: String(b.by || '').slice(0, 60) };
  } else if (b.action === 'slideshow') {
    fn = 'sale_set_slideshow';
    args = { p: staffKey, live: !!b.live };
  } else return res.status(400).json({ error: 'Unknown action' });
  const r = await fetch(SB + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) { let m = 'Could not save'; try { m = (await r.json()).message || m } catch (e) {} return res.status(502).json({ error: m }); }
  res.status(200).json({ ok: true });
};
