/**
 * Cookie Consent Banner Component
 * 
 * Jogge di Balla Design System:
 * - Farben: #E93F56 (Rot), #0B93A7 (Blau), mit Darkmode Support
 * - UI: Konsistent mit bestehenden shadcn/ui Komponenten
 * - Light/Darkmode: Automatisch angepasst via Tailwind CSS (auch System-Modus)
 * - Nutzt Tailwind's dark: Präfix für automatische System-Erkennung
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
      {/* Overlay (subtle, automatically responds to system theme) */}
      <div className="absolute inset-0 bg-black/10 dark:bg-black/20 backdrop-blur-sm pointer-events-none" />

      {/* Banner */}
      <div className="relative border-t shadow-2xl bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          {/* Collapsed view */}
          {!expanded && (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  Wir nutzen <strong>Google Analytics</strong> um die Website zu verbessern. 
                  Deine Zustimmung ist erforderlich. Weitere Details findest du in unserer{' '}
                  <a
                    href="/datenschutz"
                    className="font-medium text-[#0B93A7] hover:text-[#084f5f] dark:hover:text-[#0a7a8a] hover:underline transition-colors"
                  >
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
                  className="text-xs font-medium border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  Ablehnen
                </Button>
                <Button
                  size="sm"
                  onClick={onAcceptAll}
                  className="text-xs font-medium text-white bg-[#0B93A7] hover:bg-[#084f5f] transition-colors"
                >
                  Akzeptieren
                </Button>
                <button
                  onClick={() => setExpanded(true)}
                  className="p-1.5 rounded transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900"
                  aria-label="Mehr Optionen"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Expanded view */}
          {expanded && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Cookie-Einstellungen
                </h3>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1 rounded transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900"
                  aria-label="Schliessen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Cookie categories */}
              <div className="space-y-3 p-3 rounded border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                {/* Functional (always on) */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="functional"
                    checked={true}
                    disabled
                    className="mt-1 cursor-not-allowed rounded accent-[#0B93A7] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="functional"
                      className="text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Funktional (erforderlich)
                    </label>
                    <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
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
                    className="mt-1 cursor-pointer rounded accent-[#0B93A7] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="analytics"
                      className="text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Google Analytics
                    </label>
                    <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
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
                    className="mt-1 cursor-pointer rounded accent-[#0B93A7] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="marketing"
                      className="text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Marketing & Werbung
                    </label>
                    <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
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
                  className="text-xs font-medium border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  Alle ablehnen
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onCustom(customAnalytics, customMarketing);
                    setExpanded(false);
                  }}
                  className="text-xs font-medium text-white bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                >
                  Speichern
                </Button>
                <Button
                  size="sm"
                  onClick={onAcceptAll}
                  className="text-xs font-medium text-white bg-[#0B93A7] hover:bg-[#084f5f] transition-colors"
                >
                  Alle akzeptieren
                </Button>
              </div>

              {/* Info */}
              <p className="text-xs text-gray-600 dark:text-gray-500">
                Du kannst deine Einstellungen jederzeit in der{' '}
                <a
                  href="/datenschutz"
                  className="font-medium text-[#0B93A7] hover:text-[#084f5f] dark:hover:text-[#0a7a8a] hover:underline transition-colors"
                >
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
