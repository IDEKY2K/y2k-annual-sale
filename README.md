# Y2K Vintage Annual Sale

The mobile page the annual sale QR code opens: https://sale.y2kxvintage.com (Vercel, custom domain via IONOS CNAME).

Plain static site, no build step.

- `index.html` – the page: category buttons and a photo grid per category.
- `items.json` – `categories` (order shown on the page) and `items`: each has `category`, `photo` (URL or `photos/<file>`), `active`. An item with no photo shows a grey placeholder.
- `photos/` – product photos (keep them under ~300 KB each).
