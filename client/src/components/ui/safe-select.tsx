/**
 * SafeSelect – A custom select component that avoids Radix UI Portal rendering.
 * Solves Safari/MacOS DOM manipulation errors while keeping a modern design.
 */
import { useRef, useState, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SafeSelectOption {
  value: string;
  label: string;
}

interface SafeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SafeSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function SafeSelect({
  value,
  onValueChange,
  options,
  placeholder = "Auswählen...",
  className,
  disabled = false,
  id,
}: SafeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const triggerId = id ?? uid;

  const selectedOption = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((prev) => !prev);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      const currentIndex = options.findIndex((o) => o.value === value);
      const next = options[(currentIndex + 1) % options.length];
      if (next) onValueChange(next.value);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      const currentIndex = options.findIndex((o) => o.value === value);
      const prev = options[(currentIndex - 1 + options.length) % options.length];
      if (prev) onValueChange(prev.value);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        id={triggerId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "hover:bg-muted transition-colors cursor-pointer",
          open && "ring-2 ring-ring ring-offset-2"
        )}
      >
        <span className={cn(!selectedOption && "text-muted-foreground")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown – rendered inline (no portal) */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click registers
                  onValueChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm cursor-pointer select-none",
                  "hover:bg-muted hover:text-foreground transition-colors",
                  isSelected && "bg-muted font-medium text-foreground"
                )}
              >
                {option.label}
                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
