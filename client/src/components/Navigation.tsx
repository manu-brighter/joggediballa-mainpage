import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Sun, Moon, Monitor, Settings, LogOut, Users, LogIn, Lock } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermission } from "@/hooks/usePermissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// Map nav items to their feature toggle names
const NAV_FEATURE_MAP: Record<string, string> = {
  "/shotcounter": "nav_shotcounter",
  "/events": "nav_events",
  "/dienstleistungen": "nav_dienstleistungen",
  "/sponsors": "nav_sponsors",
};

// Items that cannot be disabled
const ALWAYS_VISIBLE = ["/", "/team", "/contact"];

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, loading } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const logoutMutation = trpc.auth.logout.useMutation();
  const [location, setLocation] = useLocation();

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location]);

  // Fetch feature toggles for navbar visibility
  const { data: featureToggles = [] } = trpc.features.list.useQuery(undefined, {
    staleTime: 30000,
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = "/";
  };

  const allNavLinks = [
    { href: "/", label: "Home" },
    { href: "/shotcounter", label: "Shotcounter" },
    { href: "/team", label: "Team" },
    { href: "/events", label: "Events & Fotos" },
    { href: "/dienstleistungen", label: "Dienstleistungen" },
    { href: "/sponsors", label: "Sponsoren" },
    { href: "/contact", label: "Kontakt" },
  ];

  // Check if a nav item is enabled
  const isNavEnabled = (href: string): boolean => {
    const featureName = NAV_FEATURE_MAP[href];
    if (!featureName) return true; // Always visible items
    const toggle = featureToggles.find(f => f.featureName === featureName);
    return toggle?.isEnabled ?? true; // Default to enabled if not set
  };

  // Split nav links into visible and hidden
  const { visibleLinks, hiddenLinks } = useMemo(() => {
    const visible: typeof allNavLinks = [];
    const hidden: typeof allNavLinks = [];

    allNavLinks.forEach(link => {
      // Always visible items are always shown
      if (ALWAYS_VISIBLE.includes(link.href)) {
        visible.push(link);
      }
      // Feature-toggled items
      else if (isNavEnabled(link.href)) {
        visible.push(link);
      }
      // Disabled items - only show to authenticated users (with lock icon)
      else if (isAuthenticated) {
        hidden.push(link);
      }
      // For non-authenticated users, disabled items are completely hidden
    });

    return { visibleLinks: visible, hiddenLinks: hidden };
  }, [featureToggles, isAuthenticated]);

  const ThemeIcon = () => {
    if (theme === "system") return <Monitor className="h-4 w-4" />;
    if (resolvedTheme === "dark") return <Moon className="h-4 w-4" />;
    return <Sun className="h-4 w-4" />;
  };

  const canViewGoennermitglieder = usePermission("manage_goennermitglieder");

  return (
    <>
      <nav className={cn(
        "sticky top-0 z-40 w-full border-b backdrop-blur-lg supports-[backdrop-filter]:bg-background/60",
        "bg-background/80 dark:bg-background/70 dark:border-primary/10"
      )}>
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <img 
            src="/JoggediBalla-Logo.PNG"
            loading="eager" 
            alt="Jogge di Balla Logo" 
            className="h-8 sm:h-10 w-auto transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:space-x-1">
          {/* Visible nav links */}
          {visibleLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                location === link.href 
                  ? "text-primary bg-primary/10" 
                  : "text-foreground/70 hover:text-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
          
          {/* Hidden links (only for logged in users) */}
          {isAuthenticated && hiddenLinks.length > 0 && (
            <>
              <div className="h-6 w-px bg-border mx-2" />
              {hiddenLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5",
                    location === link.href 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Lock className="h-3 w-3" />
                  {link.label}
                </Link>
              ))}
            </>
          )}
          
          {/* Divider and Gönnermitglieder - only visible with permission */}
          {canViewGoennermitglieder && (
            <>
              <div className="h-6 w-px bg-border mx-2" />
              <Link 
                href="/goennermitglieder"
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-1.5",
                  location === "/goennermitglieder" 
                    ? "text-primary bg-primary/10" 
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                )}
              >
                <Users className="h-4 w-4" />
                Gönner
              </Link>
            </>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2">
          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ThemeIcon />
                <span className="sr-only">Theme wechseln</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Erscheinungsbild</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTheme("light")} className={cn(theme === "light" && "bg-muted")}>
                <Sun className="mr-2 h-4 w-4" />
                Hell
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")} className={cn(theme === "dark" && "bg-muted")}>
                <Moon className="mr-2 h-4 w-4" />
                Dunkel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")} className={cn(theme === "system" && "bg-muted")}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth Section */}
          {!loading && (
            <>
              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                      <Avatar className="h-9 w-9 ring-2 ring-primary/30 hover:ring-primary/50 transition-all">
                        {user.profilePictureUrl ? (
                          <AvatarImage 
                            src={user.profilePictureUrl} 
                            alt={user.name || "User"} 
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                          {user.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <div className="flex items-center gap-3 p-3">
                      <Avatar className="h-12 w-12">
                        {user.profilePictureUrl ? (
                          <AvatarImage 
                            src={user.profilePictureUrl} 
                            alt={user.name || "User"} 
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                          {user.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <p className="text-sm font-semibold">{user.name || "User"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</p>
                        <span className="text-xs text-primary font-medium capitalize mt-0.5">
                          {user.role}
                        </span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="w-full cursor-pointer flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Profil bearbeiten
                      </Link>
                    </DropdownMenuItem>
                    {user.role === "admin" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="w-full cursor-pointer flex items-center">
                          <Settings className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Abmelden
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="default" size="sm" className="btn-animate">
                  <a href={getLoginUrl()} className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-lg">
          <div className="container py-4 space-y-1">
            {/* Visible links */}
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  location === link.href 
                    ? "text-primary bg-primary/10" 
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
            
            {/* Hidden links for logged in users */}
            {isAuthenticated && hiddenLinks.length > 0 && (
              <>
                <div className="h-px bg-border my-2" />
                <p className="px-4 py-1 text-xs text-muted-foreground">Nur für Mitglieder</p>
                {hiddenLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                      location === link.href 
                        ? "text-primary bg-primary/10" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Lock className="h-3 w-3" />
                    {link.label}
                  </Link>
                ))}
              </>
            )}
            
            {/* Gönnermitglieder - only visible with permission */}
            {canViewGoennermitglieder && (
              <>
                <div className="h-px bg-border my-2" />
                <Link
                  href="/goennermitglieder"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                    location === "/goennermitglieder" 
                      ? "text-primary bg-primary/10" 
                      : "text-foreground/70 hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Users className="h-4 w-4" />
                  Gönnermitglieder
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
      
      {/* Visitor Banner */}
      {isAuthenticated && user?.role === "visitor" && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 py-3">
          <div className="container">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-orange-500" />
              <span className="text-orange-700 dark:text-orange-300">
                Dein Account wartet auf Freischaltung. Du hast derzeit eingeschränkten Zugriff.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
