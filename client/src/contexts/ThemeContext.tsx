import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (switchable && typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme | null;
      return stored || defaultTheme;
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme as ResolvedTheme;
  });

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Update resolved theme when theme changes
  useEffect(() => {
    if (theme === "system") {
      setResolvedTheme(getSystemTheme());
    } else {
      setResolvedTheme(theme as ResolvedTheme);
    }
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }

    // Inject datepicker icon styles via JavaScript.
    // CSS selectors inside Tailwind v4 @layer blocks get transformed and
    // cannot reliably target ::-webkit-calendar-picker-indicator in dark mode.
    // Injecting a <style> tag directly bypasses this issue entirely.
    const styleId = "datepicker-dark-mode-style";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    if (resolvedTheme === "dark") {
      styleEl.textContent = [
        "input[type='date']::-webkit-calendar-picker-indicator,",
        "input[type='time']::-webkit-calendar-picker-indicator {",
        "  filter: invert(1) brightness(0.85) !important;",
        "  opacity: 0.7 !important;",
        "  cursor: pointer;",
        "}",
        "input[type='date']:hover::-webkit-calendar-picker-indicator,",
        "input[type='time']:hover::-webkit-calendar-picker-indicator {",
        "  opacity: 1 !important;",
        "}",
        "input[type='date'], input[type='time'] { color-scheme: dark; }",
      ].join("\n");
    } else {
      styleEl.textContent = [
        "input[type='date']::-webkit-calendar-picker-indicator,",
        "input[type='time']::-webkit-calendar-picker-indicator {",
        "  filter: none !important;",
        "  opacity: 0.6;",
        "}",
        "input[type='date'], input[type='time'] { color-scheme: light; }",
      ].join("\n");
    }
  }, [resolvedTheme, theme, switchable]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = switchable
    ? () => {
        // Cycle through: light -> dark -> system -> light
        setThemeState(prev => {
          if (prev === "light") return "dark";
          if (prev === "dark") return "system";
          return "light";
        });
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
