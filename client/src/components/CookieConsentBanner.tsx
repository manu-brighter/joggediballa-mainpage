/**
 * Cookie Consent Banner Component
 * 
 * Dezent, revDSG-konform, mit Opt-in für Google Analytics.
 * Wird nur beim ersten Besuch oder nach Consent-Ablauf angezeigt.
 * 
 * Design: Minimalistisch, am unteren Rand, keine aggressiven Dark Patterns.
 */

import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CookieConsentBannerProps {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustom: (analytics: boolean, marketing: boolean) => void;
  isVisible: boolean;
}

export function CookieConsentBanner({
  onAcceptAll,
  onRejectAll,
  onCustom,
  isVisible,
}: CookieConsentBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [customAnalytics, setCustomAnalytics] = useState(false);
  const [customMarketing, setCustomMarketing] = useState(false);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 transition-all duration-300',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      )}
    >
      {/* Overlay (subtle) */}
      <div className="absolute inset-0 bg-black/5 backdrop-blur-sm pointer-events-none" />

      {/* Banner */}
      <div className="relative bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          {/* Collapsed view */}
          {!expanded && (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Wir nutzen <strong>Google Analytics</strong> um die Website zu verbessern. 
                  Deine Zustimmung ist erforderlich. Weitere Details findest du in unserer{' '}
                  <a href="/datenschutz" className="text-blue-600 hover:underline font-medium">
                    Datenschutzerklärung
                  </a>
                  .
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRejectAll}
                  className="text-xs"
                >
                  Ablehnen
                </Button>
                <Button
                  size="sm"
                  onClick={onAcceptAll}
                  className="text-xs bg-blue-600 hover:bg-blue-700"
                >
                  Akzeptieren
                </Button>
                <button
                  onClick={() => setExpanded(true)}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  aria-label="Mehr Optionen"
                >
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}

          {/* Expanded view */}
          {expanded && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Cookie-Einstellungen</h3>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  aria-label="Schliessen"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>

              {/* Cookie categories */}
              <div className="space-y-3 bg-gray-50 p-3 rounded">
                {/* Functional (always on) */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="functional"
                    checked={true}
                    disabled
                    className="mt-1 cursor-not-allowed"
                  />
                  <div className="flex-1">
                    <label htmlFor="functional" className="text-sm font-medium text-gray-900">
                      Funktional (erforderlich)
                    </label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Notwendig für die Website-Funktionalität (Login, Sicherheit).
                    </p>
                  </div>
                </div>

                {/* Analytics */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="analytics"
                    checked={customAnalytics}
                    onChange={(e) => setCustomAnalytics(e.target.checked)}
                    className="mt-1 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="analytics" className="text-sm font-medium text-gray-900">
                      Google Analytics
                    </label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Hilft uns zu verstehen, wie du die Website nutzt (anonymisierte Daten).
                    </p>
                  </div>
                </div>

                {/* Marketing */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="marketing"
                    checked={customMarketing}
                    onChange={(e) => setCustomMarketing(e.target.checked)}
                    className="mt-1 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="marketing" className="text-sm font-medium text-gray-900">
                      Marketing & Werbung
                    </label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Für personalisierte Inhalte und Werbung (optional).
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRejectAll}
                  className="text-xs"
                >
                  Alle ablehnen
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onCustom(customAnalytics, customMarketing);
                    setExpanded(false);
                  }}
                  className="text-xs bg-gray-900 hover:bg-gray-800"
                >
                  Speichern
                </Button>
                <Button
                  size="sm"
                  onClick={onAcceptAll}
                  className="text-xs bg-blue-600 hover:bg-blue-700"
                >
                  Alle akzeptieren
                </Button>
              </div>

              {/* Info */}
              <p className="text-xs text-gray-500">
                Du kannst deine Einstellungen jederzeit in der{' '}
                <a href="/datenschutz" className="text-blue-600 hover:underline">
                  Datenschutzerklärung
                </a>{' '}
                ändern.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
