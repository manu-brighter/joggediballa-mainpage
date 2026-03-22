import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { Calendar, Clock } from "lucide-react";
import * as React from "react";
import { Input } from "./input";

/**
 * Shared inline styles that completely remove the native browser icon
 * and set color-scheme so the popup respects dark/light mode.
 */
function useDateTimeStyles() {
  const { resolvedTheme } = useTheme();
  return {
    colorScheme: resolvedTheme === "dark" ? "dark" : "light",
  } as React.CSSProperties;
}

/**
 * DateInput — wraps a native <input type="date"> but completely removes
 * the browser's built-in calendar icon and renders a Lucide `Calendar`
 * SVG icon instead. The SVG inherits `currentColor` so it automatically
 * adapts to light/dark mode. `color-scheme` is set dynamically so the
 * browser's date-picker popup also respects the current theme.
 *
 * Mobile fix: `<input type="date">` has a browser-imposed minimum width
 * that can overflow its container. We contain it with `max-w-full` and
 * `overflow-hidden` on the wrapper, and force `min-w-0 w-full` on the
 * input itself so it never exceeds the available space.
 */
const DateInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { wrapperClassName?: string }
>(({ className, wrapperClassName, style, ...props }, ref) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const themeStyles = useDateTimeStyles();

  React.useImperativeHandle(ref, () => inputRef.current!);

  const openPicker = () => {
    try {
      inputRef.current?.showPicker();
    } catch {
      inputRef.current?.click();
    }
  };

  return (
    <div className={cn("relative w-full max-w-full overflow-hidden rounded-md", wrapperClassName)}>
      <Input
        ref={inputRef}
        type="date"
        style={{ ...themeStyles, ...style }}
        className={cn(
          // Completely hide the native calendar icon
          "[&::-webkit-calendar-picker-indicator]:!hidden",
          "[&::-webkit-inner-spin-button]:!hidden",
          "[&::-webkit-clear-button]:!hidden",
          // Force the input to stay within its container on mobile
          "w-full min-w-0 max-w-full",
          "pr-9",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Kalender öffnen"
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  );
});
DateInput.displayName = "DateInput";

/**
 * TimeInput — same approach but for <input type="time"> with a Clock icon.
 */
const TimeInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { wrapperClassName?: string }
>(({ className, wrapperClassName, style, ...props }, ref) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const themeStyles = useDateTimeStyles();

  React.useImperativeHandle(ref, () => inputRef.current!);

  const openPicker = () => {
    try {
      inputRef.current?.showPicker();
    } catch {
      inputRef.current?.click();
    }
  };

  return (
    <div className={cn("relative w-full max-w-full overflow-hidden rounded-md", wrapperClassName)}>
      <Input
        ref={inputRef}
        type="time"
        style={{ ...themeStyles, ...style }}
        className={cn(
          "[&::-webkit-calendar-picker-indicator]:!hidden",
          "[&::-webkit-inner-spin-button]:!hidden",
          "[&::-webkit-clear-button]:!hidden",
          // Force the input to stay within its container on mobile
          "w-full min-w-0 max-w-full",
          "pr-9",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Uhrzeit wählen"
      >
        <Clock className="h-4 w-4" />
      </button>
    </div>
  );
});
TimeInput.displayName = "TimeInput";

export { DateInput, TimeInput };
