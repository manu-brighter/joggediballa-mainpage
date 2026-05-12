import { Link } from 'wouter';
import { Instagram, Mail, ArrowRight } from 'lucide-react';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuth();

  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="container py-12 md:py-16 space-y-10">
        {/* Brand statement — logo + closing line */}
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-end md:gap-12">
          <img
            src="/JoggediBalla-Logo.PNG"
            alt="Jogge di Balla Logo"
            className="h-16 md:h-24 w-auto"
            loading="lazy"
          />
          <div className="space-y-2 md:pb-2">
            <p className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
              Brislach laut,{' '}
              <span className="gradient-text whitespace-nowrap">seit 2022</span>.
            </p>
            <p className="text-base text-muted-foreground">
              Event- und Kulturverein.
            </p>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="btn-animate gap-2">
            <Link href="/contact">
              <Mail className="h-4 w-4" />
              Schreib uns
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" className="btn-animate social-instagram gap-2">
            <a
              href="https://instagram.com/joggediballa"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram className="h-4 w-4" />
              @joggediballa
            </a>
          </Button>
        </div>

        {/* Service links + copyright */}
        <div className="flex flex-col gap-4 border-t pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-start"
          >
            <Link
              href="/impressum"
              className="hover:text-foreground transition-colors"
            >
              Impressum
            </Link>
            <span aria-hidden="true" className="opacity-50">
              ·
            </span>
            <Link
              href="/datenschutz"
              className="hover:text-foreground transition-colors"
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
                  className="hover:text-foreground transition-colors"
                >
                  Mitglieder-Login
                </a>
              </>
            )}
          </nav>
          <div className="text-center md:text-right">
            <p>© {currentYear} Jogge di Balla</p>
            <p className="opacity-70">Fotos © Manuel Heller</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
