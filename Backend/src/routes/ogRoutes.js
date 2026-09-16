import express from 'express';
import Product from '../models/Product.js';

const router = express.Router();

const SITE_URL = process.env.SITE_URL || 'https://saathigro.in';

// Detect social media / WhatsApp crawlers by User-Agent
const isSocialCrawler = (ua = '') => {
  const bots = [
    'whatsapp', 'facebookexternalhit', 'facebot',
    'twitterbot', 'linkedinbot', 'slackbot', 'telegrambot',
    'discordbot', 'pinterest', 'googlebot', 'bingbot'
  ];
  const lower = ua.toLowerCase();
  return bots.some((bot) => lower.includes(bot));
};

// Escape HTML special chars
const escape = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Build the minimal OG HTML page
const buildOgHtml = (product, productId) => {
  const productUrl = `${SITE_URL}/product/${productId}`;

  const name     = product?.name        || 'Fresh Grocery Delivery';
  const desc     = product?.description || 'Order fresh groceries at your doorstep via SaathiGro.';
  const price    = product?.basePrice   ?? null;
  const mrp      = product?.mrp         ?? null;
  const rawImage = product?.image       || `${SITE_URL}/favicon.png`;

  const absoluteImage = rawImage.startsWith('http')
    ? rawImage
    : `${SITE_URL}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;

  const discount =
    mrp && price && mrp > price
      ? Math.round(((mrp - price) / mrp) * 100)
      : 0;

  const priceLabel =
    price != null
      ? discount > 0
        ? `₹${price} (${discount}% OFF from ₹${mrp})`
        : `₹${price}`
      : '';

  const fullDesc = priceLabel
    ? `${priceLabel} • ${desc.slice(0, 150)}`
    : desc.slice(0, 200);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escape(name)} | Saathi-Grow</title>
  <meta name="description" content="${escape(fullDesc)}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${escape(name)} | Saathi-Grow" />
  <meta property="og:description" content="${escape(fullDesc)}" />
  <meta property="og:image" content="${absoluteImage}" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="800" />
  <meta property="og:url" content="${productUrl}" />
  <meta property="og:site_name" content="Saathi-Grow" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escape(name)} | Saathi-Grow" />
  <meta name="twitter:description" content="${escape(fullDesc)}" />
  <meta name="twitter:image" content="${absoluteImage}" />
  <meta http-equiv="refresh" content="0;url=${productUrl}" />
</head>
<body>
  <p>Loading <a href="${productUrl}">${escape(name)}</a>...</p>
</body>
</html>`;
};

// GET /api/og/product/:id
// Nginx proxies to this when it detects a social crawler UA on /product/:id
router.get('/product/:id', async (req, res) => {
  const { id } = req.params;
  const ua = req.headers['user-agent'] || '';

  // Safety valve — redirect real browsers to the SPA
  if (!isSocialCrawler(ua)) {
    return res.redirect(302, `${SITE_URL}/product/${id}`);
  }

  try {
    const product = await Product
      .findById(id)
      .select('name description basePrice mrp image')
      .lean();

    const html = buildOgHtml(product, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[OG] Failed to fetch product:', err.message);
    const html = buildOgHtml(null, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }
});

export default router;
