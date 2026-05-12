import { Fragment } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  noIndex?: boolean;
}

/**
 * SEO meta tags rendered as JSX. React 19 hoists <title>, <meta>, and <link>
 * into <head> automatically and removes them on unmount — no DOM imperatives.
 */
export function SEO({
  title,
  description,
  keywords,
  ogImage,
  ogUrl,
  noIndex,
}: SEOProps) {
  return (
    <Fragment>
      {title && <title>{title}</title>}
      {title && <meta name="title" content={title} />}
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {title && <meta property="og:title" content={title} />}
      {description && (
        <meta property="og:description" content={description} />
      )}
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogUrl && <meta property="og:url" content={ogUrl} />}
      {title && <meta property="twitter:title" content={title} />}
      {description && (
        <meta property="twitter:description" content={description} />
      )}
      {ogImage && <meta property="twitter:image" content={ogImage} />}
      {ogUrl && <meta property="twitter:url" content={ogUrl} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {noIndex && <meta name="google" content="notranslate" />}
    </Fragment>
  );
}
