import React from 'react';
import { Helmet } from 'react-helmet-async';

/**
 * SEO Component for dynamic meta tags
 * @param {string} title - Page title
 * @param {string} description - Meta description
 * @param {string} keywords - Meta keywords
 * @param {string} image - OG image URL
 * @param {string} url - Canonical URL
 * @param {string} type - OG type (website, product, etc)
 */
const SEO = ({ 
  title, 
  description = "Saathi-Grow: Premium fresh grocery delivery, organic produce, and daily essentials. Fast delivery, best prices, and quality products at your doorstep. Shop now on SaathiGro!", 
  keywords = "Saathi-Grow, SaathiGro, grocery delivery, online grocery shopping, fresh vegetables, organic fruits, daily essentials, quick commerce, fresh milk delivery, home delivery grocery, Saathi-Grow store, local shopping",
  image = "/og-image.jpg", 
  url,
  type = "website",
  schemaData = null
}) => {
  const siteName = "Saathi-Grow";
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const canonicalUrl = url || window.location.href;
  // Ensure og:image is always an absolute URL (required for WhatsApp / social crawlers)
  const absoluteImage = image
    ? (image.startsWith('http') ? image : `${window.location.origin}${image.startsWith('/') ? '' : '/'}${image}`)
    : `${window.location.origin}/favicon.png`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonicalUrl} />

      {/* JSON-LD Schema */}
      {schemaData && (
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:width" content="800" />
      <meta property="og:image:height" content="800" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />

      {/* Theme Color */}
      <meta name="theme-color" content="#2e7d32" />
    </Helmet>
  );
};

export default SEO;
