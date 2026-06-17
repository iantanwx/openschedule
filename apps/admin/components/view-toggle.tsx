"use client";

import { cn } from "@openschedule/ui/lib/utils";

interface ViewToggleProps {
  value: "my" | "all";
  onChange: (value: "my" | "all") => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-0.5" role="radiogroup" aria-label="View scope">
      <button
        type="button"
        role="radio"
        aria-checked={value === "my"}
        className={cn(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors",
          value === "my"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("my")}
      >
        My
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "all"}
        className={cn(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors",
          value === "all"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("all")}
      >
        All
      </button>
    </div>
  );
}
