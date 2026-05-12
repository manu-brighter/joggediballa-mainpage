import { Link } from 'wouter';
import { Instagram, ArrowRight } from 'lucide-react';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuth();

  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="container py-8 space-y-6">
        {/* Top: brand-marker on the left, contact CTAs on the right */}
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
              className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Instagram className="h-3.5 w-3.5" />
              @joggediballa
            </a>
          </div>
        </div>

        {/* Bottom: legal + copyright */}
        <div className="flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
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
