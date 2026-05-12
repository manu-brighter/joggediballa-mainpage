/**
 * Cookie Consent Banner
 *
 * Uses semantic design tokens (primary, card, muted-foreground, border, ...)
 * so the banner inherits dark-mode colors from the design system without
 * any hardcoded hex literals.
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
  const [customAnalytics, setCustomAnalytics] = useState(true);
  const [customMarketing, setCustomMarketing] = useState(true);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 transition-all duration-300',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0 pointer-events-none',
      )}
    >
      {/* Subtle scrim */}
      <div className="absolute inset-0 bg-foreground/5 backdrop-blur-sm pointer-events-none" />

      {/* Banner */}
      <div className="relative border-t shadow-2xl bg-card text-card-foreground">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          {/* Collapsed view — stacks vertically on mobile, side-by-side on md+ */}
          {!expanded && (
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">
                Wir nutzen <strong>Google Analytics</strong> um die Website zu
                verbessern. Deine Zustimmung ist erforderlich. Weitere Details
                findest du in unserer{' '}
                <a
                  href="/datenschutz"
                  className="font-medium text-primary hover:underline transition-colors"
                >
                  Datenschutzerklärung
                </a>
                .
              </p>

              <div className="flex items-center gap-2 md:flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRejectAll}
                  className="flex-1 md:flex-none text-xs font-medium"
                >
                  Ablehnen
                </Button>
                <Button
                  size="sm"
                  onClick={onAcceptAll}
                  className="flex-1 md:flex-none text-xs font-medium"
                >
                  Akzeptieren
                </Button>
                <button
                  onClick={() => setExpanded(true)}
                  className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
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
                <h3 className="text-sm font-semibold text-foreground">
                  Cookie-Einstellungen
                </h3>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Schliessen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Cookie categories */}
              <div className="space-y-3 p-3 rounded border bg-muted/40">
                {/* Functional (always on) */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="functional"
                    checked={true}
                    disabled
                    className="mt-1 cursor-not-allowed rounded accent-primary"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="functional"
                      className="text-sm font-medium text-foreground"
                    >
                      Funktional (erforderlich)
                    </label>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      Notwendig für die Website-Funktionalität (Login,
                      Sicherheit).
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
                    className="mt-1 cursor-pointer rounded accent-primary"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="analytics"
                      className="text-sm font-medium text-foreground"
                    >
                      Google Analytics
                    </label>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      Hilft uns zu verstehen, wie du die Website nutzt
                      (anonymisierte Daten).
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
                    className="mt-1 cursor-pointer rounded accent-primary"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="marketing"
                      className="text-sm font-medium text-foreground"
                    >
                      Marketing & Werbung
                    </label>
                    <p className="text-xs mt-0.5 text-muted-foreground">
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
                  className="text-xs font-medium"
                >
                  Alle ablehnen
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onCustom(customAnalytics, customMarketing);
                    setExpanded(false);
                  }}
                  className="text-xs font-medium"
                >
                  Speichern
                </Button>
                <Button
                  size="sm"
                  onClick={onAcceptAll}
                  className="text-xs font-medium"
                >
                  Alle akzeptieren
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Du kannst deine Einstellungen jederzeit in der{' '}
                <a
                  href="/datenschutz"
                  className="font-medium text-primary hover:underline transition-colors"
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
