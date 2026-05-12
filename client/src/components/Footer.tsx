import { useId } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, LogOut } from 'lucide-react';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

// Inline copy of the lucide Instagram icon with a gradient stroke instead
// of currentColor — needed because bg-clip:text breaks SVG icons that
// inherit text-color. useId() so multiple instances on one page don't
// collide on the <defs> gradient id.
function InstagramGradientIcon({ className }: { className?: string }) {
  const gradientId = `insta-gradient-${useId()}`;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="oklch(0.61 0.24 305)" />
          <stop offset="1" stopColor="oklch(0.65 0.23 6)" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        stroke={`url(#${gradientId})`}
      />
      <path
        d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"
        stroke={`url(#${gradientId})`}
      />
      <line
        x1="17.5"
        y1="6.5"
        x2="17.51"
        y2="6.5"
        stroke={`url(#${gradientId})`}
      />
    </svg>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation();

  // Mirrors Navigation.tsx — SPA-style logout, clear auth cache, route home.
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      setLocation('/');
    }
  };

  // On Home, Insta + Schreib-uns CTAs are already in the page itself
  // (Social section + Gönner-CTA). Swap them out of the footer-top and
  // put Impressum/Datenschutz there instead, leaving the bottom row to
  // just the copyright (+ optional Mitglieder-Login).
  const isHome = location === '/';

  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="container py-8 space-y-6">
        {/* Top: brand-marker on the left, contextual links on the right */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/JoggediBalla-Logo.PNG"
              alt="Jogge di Balla Logo"
              className="h-10 w-auto"
              loading="lazy"
            />
            <div className="text-sm leading-tight">
              <p className="font-semibold">Brislach laut, seit 2022.</p>
              <p className="text-xs text-muted-foreground">
                Event- und Kulturverein
              </p>
            </div>
          </div>

          {isHome ? (
            <nav
              aria-label="Rechtliches"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
            >
              <Link
                href="/impressum"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Impressum
              </Link>
              <span aria-hidden="true" className="text-muted-foreground/40">
                ·
              </span>
              <Link
                href="/datenschutz"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Datenschutz
              </Link>
            </nav>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link
                href="/contact"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Schreib uns
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <span aria-hidden="true" className="text-muted-foreground/40">
                ·
              </span>
              <a
                href="https://instagram.com/joggediballa"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
              >
                <InstagramGradientIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="gradient-text-instagram font-medium">
                  @joggediballa
                </span>
              </a>
            </div>
          )}
        </div>

        {/* Bottom: legal (off-Home) + copyright */}
        <div className="flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          {isHome ? (
            // Legal links already shown above on Home; the bottom-left
            // stays useful: login when out, logout when in.
            !isAuthenticated ? (
              <a
                href={getLoginUrl()}
                className="transition-colors hover:text-foreground"
              >
                Mitglieder-Login
              </a>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground disabled:opacity-60"
              >
                <LogOut className="h-3 w-3" aria-hidden="true" />
                {logoutMutation.isPending ? 'Logout…' : 'Logout'}
              </button>
            )
          ) : (
            <nav
              aria-label="Footer"
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <Link
                href="/impressum"
                className="transition-colors hover:text-foreground"
              >
                Impressum
              </Link>
              <span aria-hidden="true" className="opacity-50">
                ·
              </span>
              <Link
                href="/datenschutz"
                className="transition-colors hover:text-foreground"
              >
                Datenschutz
              </Link>
              {!isAuthenticated && (
                <>
                  <span aria-hidden="true" className="opacity-50">
                    ·
                  </span>
                  <a
                    href={getLoginUrl()}
                    className="transition-colors hover:text-foreground"
                  >
                    Mitglieder-Login
                  </a>
                </>
              )}
            </nav>
          )}
          <p>
            © {currentYear} Jogge di Balla
            <span aria-hidden="true" className="mx-2 opacity-50">
              ·
            </span>
            <span className="opacity-70">Fotos © Manuel Heller</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
