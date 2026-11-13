// Returns the approximate location of the visitor, from Vercel's IP-based geo headers.
// Used by index.html to add city/region/country to each sale_visits row. Not stored here.
module.exports = function handler(req, res) {
  const h = (k) => { try { return decodeURIComponent(req.headers[k] || '') || null } catch (e) { return req.headers[k] || null } };
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ city: h('x-vercel-ip-city'), region: h('x-vercel-ip-country-region'), country: h('x-vercel-ip-country') });
}
