import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Sun, Moon, Monitor, Settings, LogOut, Users, LogIn } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
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

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, loading } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const logoutMutation = trpc.auth.logout.useMutation();
  const [location] = useLocation();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = "/";
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shotcounter", label: "Shotcounter" },
    { href: "/team", label: "Team" },
    { href: "/events", label: "Events & Fotos" },
    { href: "/dienstleistungen", label: "Dienstleistungen" },
    { href: "/sponsors", label: "Sponsoren" },
    { href: "/contact", label: "Kontakt" },
  ];

  const ThemeIcon = () => {
    if (theme === "system") return <Monitor className="h-4 w-4" />;
    if (resolvedTheme === "dark") return <Moon className="h-4 w-4" />;
    return <Sun className="h-4 w-4" />;
  };

  const isAdminOrMaintainer = isAuthenticated && user && ["admin", "maintainer"].includes(user.role);

  return (
    <nav className={cn(
      "sticky top-0 z-40 w-full border-b backdrop-blur-lg supports-[backdrop-filter]:bg-background/60",
      // Slightly brighter in dark mode with subtle teal tint
      "bg-background/80 dark:bg-background/70 dark:border-primary/10"
    )}>
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <img 
            src="/JoggediBalla-Logo.PNG" 
            alt="Jogge di Balla Logo" 
            className="h-8 sm:h-10 w-auto transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:space-x-1">
          {navLinks.map((link) => (
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
          
          {/* Divider and Gönnermitglieder - only visible for admin/maintainer */}
          {isAdminOrMaintainer && (
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
                    {isAdminOrMaintainer && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="w-full cursor-pointer flex items-center">
                            <Settings className="mr-2 h-4 w-4" />
                            Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/goennermitglieder" className="w-full cursor-pointer flex items-center">
                            <Users className="mr-2 h-4 w-4" />
                            Gönnermitglieder
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Abmelden
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                // Subtle login button for logged out users - just an icon
                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                  <a href={getLoginUrl()} title="Anmelden">
                    <LogIn className="h-4 w-4" />
                    <span className="sr-only">Anmelden</span>
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

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-lg animate-in slide-in-from-top-2 duration-200">
          <div className="container py-4 space-y-1">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "block py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200",
                  location === link.href 
                    ? "text-primary bg-primary/10" 
                    : "text-foreground/70 hover:text-foreground hover:bg-muted"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {isAdminOrMaintainer && (
              <>
                <div className="h-px bg-border my-2" />
                <Link 
                  href="/goennermitglieder"
                  className="block py-3 px-4 text-sm font-medium rounded-lg text-foreground/70 hover:text-foreground hover:bg-muted transition-all duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Gönnermitglieder
                </Link>
              </>
            )}
            {/* Subtle login link in mobile menu for logged out users */}
            {!isAuthenticated && !loading && (
              <>
                <div className="h-px bg-border my-2" />
                <a
                  href={getLoginUrl()}
                  className="block py-3 px-4 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LogIn className="inline-block h-4 w-4 mr-2" />
                  Anmelden
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
