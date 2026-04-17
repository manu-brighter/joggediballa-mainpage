/**
 * Google Analytics Consent-Aware Wrapper
 * 
 * Loads Google Analytics script only after user has given explicit consent.
 * Implements revDSG-compliant Opt-in model for Switzerland (April 2026).
 */

// Extend Window interface for Google Analytics
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    [key: string]: any;
  }
}

export function initGoogleAnalytics(gaId: string) {
  if (!gaId) return;

  window.dataLayer = window.dataLayer || [];

  function gtag(...args: any[]) {
    window.dataLayer.push(args);
  }

  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', gaId, {
    anonymize_ip: true,
    allow_google_signals: false, // Disable Google Signals for privacy
    allow_ad_personalization_signals: false,
  });
}

export function loadGoogleAnalyticsScript(gaId: string) {
  if (!gaId || typeof document === 'undefined') return;

  // Check if script is already loaded
  if (document.querySelector(`script[src*="googletagmanager.com/gtag"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  script.onload = () => {
    initGoogleAnalytics(gaId);
  };
  document.head.appendChild(script);
}

export function disableGoogleAnalytics() {
  if (typeof window === 'undefined') return;

  // Disable Google Analytics tracking
  window['ga-disable-G-W5PQHY4GNN'] = true;
  
  // Clear dataLayer
  window.dataLayer = [];
}
