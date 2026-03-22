import { Link } from "wouter";
import { Instagram, Heart } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuth();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shotcounter", label: "Shotcounter" },
    { href: "/team", label: "Team" },
    { href: "/events", label: "Events" },
    { href: "/sponsors", label: "Sponsoren" },
    { href: "/contact", label: "Kontakt" },
  ];

  const legalLinks = [
    { href: "/impressum", label: "Impressum" },
    { href: "/datenschutz", label: "Datenschutz" },
  ];

  return (
    <footer className="border-t bg-muted/30 mt-auto">
      <div className="container py-8 md:py-12">
        {/* Desktop Layout */}
        <div className="hidden md:grid md:grid-cols-4 gap-8">
          {/* Logo & About */}
          <div className="space-y-4">
            <img 
              src="/JoggediBalla-Logo.PNG"
              alt="Jogge di Balla Logo" 
              className="h-14 w-auto"
              loading="lazy"
            />
            <p className="text-sm text-muted-foreground">
              Gemeinsam feiern seit 2022
            </p>
            <a 
              href="https://instagram.com/joggediballa" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Instagram className="h-4 w-4" />
              @joggediballa
            </a>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold mb-4 text-sm">Navigation</h3>
            <ul className="space-y-2.5 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4 text-sm">Rechtliches</h3>
            <ul className="space-y-2.5 text-sm">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-sm">Kontakt</h3>
            <p className="text-sm text-muted-foreground">
              Fragen oder Anregungen?
            </p>
            <Link 
              href="/contact"
              className="inline-block mt-2 text-sm text-primary hover:underline"
            >
              Schreib uns →
            </Link>
          </div>
        </div>

        {/* Mobile Layout - Compact & Centered */}
        <div className="md:hidden text-center space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <img 
              src="/JoggediBalla-Logo.PNG"
              alt="Jogge di Balla Logo" 
              className="h-12 w-auto"
              loading="lazy"
            />
          </div>

          {/* Navigation Links - Horizontal */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Legal Links */}
          <div className="flex justify-center gap-4 text-sm">
            {legalLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Instagram */}
          <a 
            href="https://instagram.com/joggediballa" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Instagram className="h-4 w-4" />
            @joggediballa
          </a>
        </div>

        {/* Copyright - Both layouts */}
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            © {currentYear} Jogge di Balla. Made with <Heart className="h-3 w-3 text-secondary fill-secondary" /> in Switzerland
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Fotos © Manuel Heller
          </p>
          {!isAuthenticated && (
            <p className="mt-3 text-xs">
              <a
                href={getLoginUrl()}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                Mitglieder-Login
              </a>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
