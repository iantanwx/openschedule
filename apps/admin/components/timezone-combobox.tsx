"use client";

import { useState, useMemo } from "react";
import { Button } from "@opencal/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@opencal/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@opencal/ui/components/popover";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import { cn } from "@opencal/ui/lib/utils";

interface TimezoneOption {
  value: string;
  label: string;
}

function formatTimezoneLabel(tz: string): string {
  // "America/New_York" → "America / New York"
  return tz.replace(/_/g, " ").replace(/\//g, " / ");
}

function getAllTimezones(): TimezoneOption[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.map((tz) => ({
      value: tz,
      label: formatTimezoneLabel(tz),
    }));
  } catch {
    // Fallback for environments that don't support supportedValuesOf
    const fallback = [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Toronto",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Asia/Singapore",
      "Australia/Sydney",
      "Pacific/Auckland",
    ];
    return fallback.map((tz) => ({
      value: tz,
      label: formatTimezoneLabel(tz),
    }));
  }
}

const TIMEZONE_OPTIONS = getAllTimezones();

interface TimezoneComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}

export function TimezoneCombobox({ value, onValueChange, id }: TimezoneComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return TIMEZONE_OPTIONS.slice(0, 50);
    const lower = search.toLowerCase();
    return TIMEZONE_OPTIONS.filter(
      (opt) =>
        opt.value.toLowerCase().includes(lower) ||
        opt.label.toLowerCase().includes(lower),
    ).slice(0, 50);
  }, [search]);

  const selectedLabel = value ? formatTimezoneLabel(value) : "Select timezone...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search timezone..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
