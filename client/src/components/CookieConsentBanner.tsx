/**
 * Cookie Consent Banner Component
 * 
 * Jogge di Balla Design System:
 * - Farben: #E93F56 (Rot), #0B93A7 (Blau), mit Darkmode Support
 * - UI: Konsistent mit bestehenden shadcn/ui Komponenten
 * - Light/Darkmode: Automatisch angepasst via Tailwind CSS
 */

import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { theme } = useTheme();

  if (!isVisible) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 transition-all duration-300',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      )}
    >
      {/* Overlay (subtle, theme-aware) */}
      <div
        className={cn(
          'absolute inset-0 backdrop-blur-sm pointer-events-none',
          isDark ? 'bg-black/20' : 'bg-black/10'
        )}
      />

      {/* Banner */}
      <div
        className={cn(
          'relative border-t shadow-2xl',
          isDark
            ? 'bg-gray-950 border-gray-800'
            : 'bg-white border-gray-200'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          {/* Collapsed view */}
          {!expanded && (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p
                  className={cn(
                    'text-sm leading-relaxed',
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  )}
                >
                  Wir nutzen <strong>Google Analytics</strong> um die Website zu verbessern. 
                  Deine Zustimmung ist erforderlich. Weitere Details findest du in unserer{' '}
                  <a
                    href="/datenschutz"
                    className={cn(
                      'font-medium hover:underline transition-colors',
                      isDark
                        ? 'text-[#0B93A7] hover:text-[#0a7a8a]'
                        : 'text-[#0B93A7] hover:text-[#084f5f]'
                    )}
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
                  className={cn(
                    'text-xs font-medium',
                    isDark
                      ? 'border-gray-700 text-gray-300 hover:bg-gray-900'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
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
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    isDark
                      ? 'hover:bg-gray-900 text-gray-400'
                      : 'hover:bg-gray-100 text-gray-600'
                  )}
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
                <h3
                  className={cn(
                    'text-sm font-semibold',
                    isDark ? 'text-white' : 'text-gray-900'
                  )}
                >
                  Cookie-Einstellungen
                </h3>
                <button
                  onClick={() => setExpanded(false)}
                  className={cn(
                    'p-1 rounded transition-colors',
                    isDark
                      ? 'hover:bg-gray-900 text-gray-400'
                      : 'hover:bg-gray-100 text-gray-600'
                  )}
                  aria-label="Schliessen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Cookie categories */}
              <div
                className={cn(
                  'space-y-3 p-3 rounded border',
                  isDark
                    ? 'bg-gray-900 border-gray-800'
                    : 'bg-gray-50 border-gray-200'
                )}
              >
                {/* Functional (always on) */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="functional"
                    checked={true}
                    disabled
                    className={cn(
                      'mt-1 cursor-not-allowed rounded',
                      isDark
                        ? 'accent-[#0B93A7] bg-gray-800 border-gray-700'
                        : 'accent-[#0B93A7]'
                    )}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="functional"
                      className={cn(
                        'text-sm font-medium',
                        isDark ? 'text-white' : 'text-gray-900'
                      )}
                    >
                      Funktional (erforderlich)
                    </label>
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      )}
                    >
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
                    className={cn(
                      'mt-1 cursor-pointer rounded',
                      isDark
                        ? 'accent-[#0B93A7] bg-gray-800 border-gray-700'
                        : 'accent-[#0B93A7]'
                    )}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="analytics"
                      className={cn(
                        'text-sm font-medium',
                        isDark ? 'text-white' : 'text-gray-900'
                      )}
                    >
                      Google Analytics
                    </label>
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      )}
                    >
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
                    className={cn(
                      'mt-1 cursor-pointer rounded',
                      isDark
                        ? 'accent-[#0B93A7] bg-gray-800 border-gray-700'
                        : 'accent-[#0B93A7]'
                    )}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="marketing"
                      className={cn(
                        'text-sm font-medium',
                        isDark ? 'text-white' : 'text-gray-900'
                      )}
                    >
                      Marketing & Werbung
                    </label>
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      )}
                    >
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
                  className={cn(
                    'text-xs font-medium',
                    isDark
                      ? 'border-gray-700 text-gray-300 hover:bg-gray-900'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  Alle ablehnen
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onCustom(customAnalytics, customMarketing);
                    setExpanded(false);
                  }}
                  className={cn(
                    'text-xs font-medium text-white transition-colors',
                    isDark
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-900 hover:bg-gray-800'
                  )}
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
              <p
                className={cn(
                  'text-xs',
                  isDark ? 'text-gray-500' : 'text-gray-600'
                )}
              >
                Du kannst deine Einstellungen jederzeit in der{' '}
                <a
                  href="/datenschutz"
                  className={cn(
                    'font-medium hover:underline transition-colors',
                    isDark
                      ? 'text-[#0B93A7] hover:text-[#0a7a8a]'
                      : 'text-[#0B93A7] hover:text-[#084f5f]'
                  )}
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
