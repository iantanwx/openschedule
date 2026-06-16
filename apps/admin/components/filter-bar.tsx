"use client";

import { Button } from "@openschedule/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openschedule/ui/components/select";

type StatusFilter = "all" | "pending" | "confirmed" | "cancelled";

interface FilterBarProps {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  therapistId: string | null;
  onTherapistChange: (id: string | null) => void;
  therapists: Array<{ _id: string; name: string }>;
  showTherapistFilter: boolean;
}

const STATUSES: StatusFilter[] = ["all", "pending", "confirmed", "cancelled"];

export function FilterBar({
  status,
  onStatusChange,
  therapistId,
  onTherapistChange,
  therapists,
  showTherapistFilter,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {/* Status chips */}
      <div className="flex gap-1">
        {STATUSES.map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            className="text-xs capitalize"
            onClick={() => onStatusChange(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {/* Therapist filter (owner only) */}
      {showTherapistFilter && (
        <Select
          value={therapistId ?? "all"}
          onValueChange={(val) => onTherapistChange(val === "all" ? null : val)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All therapists" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All therapists</SelectItem>
            {therapists.map((t) => (
              <SelectItem key={t._id} value={t._id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
