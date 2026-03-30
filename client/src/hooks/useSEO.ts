import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  noIndex?: boolean;
}

/**
 * Custom hook to dynamically update SEO meta tags for each page
 * This helps Google index each page correctly with proper titles and descriptions
 */
export function useSEO({
  title,
  description,
  keywords,
  ogImage,
  ogUrl,
  noIndex,
}: SEOProps) {
  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    // Helper function to update or create meta tag
    const updateMetaTag = (selector: string, attribute: string, content: string) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement("meta");
        if (attribute === "name") {
          element.setAttribute("name", selector.replace('meta[name="', "").replace('"]', ""));
        } else if (attribute === "property") {
          element.setAttribute("property", selector.replace('meta[property="', "").replace('"]', ""));
        }
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Robots noindex
    const robotsSelector = 'meta[name="robots"]';
    if (noIndex) {
      updateMetaTag(robotsSelector, "name", "noindex, nofollow");
      // Also prevent browser auto-translation which causes React DOM errors
      updateMetaTag('meta[name="google"]', "name", "notranslate");
    } else {
      // Ensure robots tag is set to index when not noIndex
      const robotsEl = document.querySelector(robotsSelector);
      if (robotsEl) robotsEl.setAttribute("content", "index, follow");
      // Remove notranslate if it was set
      const translateEl = document.querySelector('meta[name="google"]');
      if (translateEl) translateEl.remove();
    }

    // Update standard meta tags
    if (title) {
      updateMetaTag('meta[name="title"]', "name", title);
    }
    if (description) {
      updateMetaTag('meta[name="description"]', "name", description);
    }
    if (keywords) {
      updateMetaTag('meta[name="keywords"]', "name", keywords);
    }

    // Update Open Graph tags
    if (title) {
      updateMetaTag('meta[property="og:title"]', "property", title);
    }
    if (description) {
      updateMetaTag('meta[property="og:description"]', "property", description);
    }
    if (ogImage) {
      updateMetaTag('meta[property="og:image"]', "property", ogImage);
    }
    if (ogUrl) {
      updateMetaTag('meta[property="og:url"]', "property", ogUrl);
    }

    // Update Twitter Card tags
    if (title) {
      updateMetaTag('meta[property="twitter:title"]', "property", title);
    }
    if (description) {
      updateMetaTag('meta[property="twitter:description"]', "property", description);
    }
    if (ogImage) {
      updateMetaTag('meta[property="twitter:image"]', "property", ogImage);
    }
    if (ogUrl) {
      updateMetaTag('meta[property="twitter:url"]', "property", ogUrl);
    }

    // Cleanup: Reset to default when component unmounts
    return () => {
      // Remove noindex on unmount
      const robotsEl = document.querySelector('meta[name="robots"]');
      if (robotsEl) robotsEl.setAttribute("content", "index, follow");
      document.title = "Jogge di Balla - Event- und Kulturverein seit 2022";
      updateMetaTag('meta[name="title"]', "name", "Jogge di Balla - Event- und Kulturverein seit 2022");
      updateMetaTag('meta[name="description"]', "name", "Event- und Kulturverein aus Brislach. Wir bringen Menschen zusammen für unvergessliche Momente, grossartige Events und jede Menge Spass! Shotcounter, Gönnermitglieder, DJ & Fotografie Services.");
    };
  }, [title, description, keywords, ogImage, ogUrl]);
}
