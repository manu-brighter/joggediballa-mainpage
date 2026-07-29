/**
 * Cookie Consent Hook
 *
 * Manages cookie consent state for revDSG compliance (Switzerland, April 2026).
 * Implements Opt-in model for Google Analytics and other tracking cookies.
 *
 * Best Practices:
 * - Consent is stored in localStorage with explicit user choice
 * - Google Analytics only loads after explicit opt-in
 * - Banner is shown on first visit or when consent is cleared
 * - Consent can be withdrawn at any time
 */

import { useEffect, useState } from 'react';

export type ConsentType = 'analytics' | 'marketing' | 'functional';

interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  functional: boolean; // Always true, required for site functionality
}

const CONSENT_STORAGE_KEY = 'joggediballa_cookie_consent';
const CONSENT_VERSION = '1.0'; // Bump this if consent categories change

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState>({
    analytics: false,
    marketing: false,
    functional: true,
  });
  const [showBanner, setShowBanner] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load consent from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.version === CONSENT_VERSION) {
          setConsent(parsed.consent);
          setShowBanner(false);
        } else {
          // Version mismatch: show banner again
          setShowBanner(true);
        }
      } catch {
        setShowBanner(true);
      }
    } else {
      // First visit: show banner
      setShowBanner(true);
    }

    setIsLoaded(true);
  }, []);

  // Save consent to localStorage
  const saveConsent = (newConsent: ConsentState) => {
    setConsent(newConsent);
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        consent: newConsent,
        timestamp: new Date().toISOString(),
      }),
    );
    setShowBanner(false);
  };

  // Accept all (except functional, which is always on)
  const acceptAll = () => {
    saveConsent({
      analytics: true,
      marketing: true,
      functional: true,
    });
  };

  // Reject all non-functional
  const rejectAll = () => {
    saveConsent({
      analytics: false,
      marketing: false,
      functional: true,
    });
  };

  // Custom consent
  const setCustomConsent = (newConsent: Partial<ConsentState>) => {
    saveConsent({
      ...consent,
      ...newConsent,
      functional: true, // Always required
    });
  };

  // Clear consent (for testing or user request)
  const clearConsent = () => {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    setShowBanner(true);
    setConsent({
      analytics: false,
      marketing: false,
      functional: true,
    });
  };

  return {
    consent,
    showBanner,
    isLoaded,
    acceptAll,
    rejectAll,
    setCustomConsent,
    clearConsent,
    setShowBanner,
  };
}
