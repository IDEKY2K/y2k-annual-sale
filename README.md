# Y2K Vintage Annual Sale

The mobile page the annual sale QR code opens. Poster QR encodes `https://y2kxvintage.com/sale`, which redirects (Shopify URL redirect) to this site.

Plain static site, no build step. Hosted on Vercel.

- `index.html` – the page. Price bands are the `BANDS` list near the bottom.
- `items.json` – the sale pieces: `name`, `price` (£), `store`, `photo` (URL or `photos/<file>`), `active`. Set `"sample": false` once real items are in.
- `photos/` – product photos (keep them under ~300 KB each).
