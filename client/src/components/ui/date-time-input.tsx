import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";
import * as React from "react";
import { Input } from "./input";

/**
 * DateInput — wraps a native <input type="date"> but hides the browser's
 * built-in calendar icon and renders a Lucide `Calendar` icon instead.
 * This guarantees the icon respects dark-mode colors because it is a
 * regular inline SVG that inherits `currentColor`.
 */
const DateInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { wrapperClassName?: string }
>(({ className, wrapperClassName, ...props }, ref) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Merge forwarded ref with local ref
  React.useImperativeHandle(ref, () => inputRef.current!);

  const openPicker = () => {
    try {
      inputRef.current?.showPicker();
    } catch {
      // showPicker() may throw in some browsers — click fallback
      inputRef.current?.click();
    }
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Input
        ref={inputRef}
        type="date"
        className={cn(
          // Hide the native calendar icon across browsers
          "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          "pr-9",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
        aria-label="Kalender öffnen"
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  );
});
DateInput.displayName = "DateInput";

/**
 * TimeInput — same idea but for <input type="time"> with a Clock icon.
 */
const TimeInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { wrapperClassName?: string }
>(({ className, wrapperClassName, ...props }, ref) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => inputRef.current!);

  const openPicker = () => {
    try {
      inputRef.current?.showPicker();
    } catch {
      inputRef.current?.click();
    }
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Input
        ref={inputRef}
        type="time"
        className={cn(
          "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          "pr-9",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
        aria-label="Uhrzeit wählen"
      >
        <Clock className="h-4 w-4" />
      </button>
    </div>
  );
});
TimeInput.displayName = "TimeInput";

export { DateInput, TimeInput };
