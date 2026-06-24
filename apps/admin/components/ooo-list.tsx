"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";
import { format, isBefore, parseISO } from "date-fns";

interface OooListProps {
  therapistId: string;
  onEdit: (oooId: string) => void;
}

function formatOooRange(startDate: string, startTime: string, endDate: string, endTime: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const formatTime = (time: string): string => {
    const [h, m] = time.split(":");
    const hour = parseInt(h ?? "0", 10);
    const minute = m ?? "00";
    const suffix = hour >= 12 ? "pm" : "am";
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return minute === "00" ? `${display}${suffix}` : `${display}:${minute}${suffix}`;
  };

  if (startDate === endDate) {
    // Same-day: "Tue Jun 24, 2pm – 4pm"
    return `${format(start, "EEE MMM d")}, ${formatTime(startTime)} – ${formatTime(endTime)}`;
  }

  // Multi-day: "Tue Jun 24, 2pm – Thu Jun 26, 12pm"
  return `${format(start, "EEE MMM d")}, ${formatTime(startTime)} – ${format(end, "EEE MMM d")}, ${formatTime(endTime)}`;
}

export function OooList({ therapistId, onEdit }: OooListProps) {
  const ooos = useQuery(
    convexApi.queries.ooo.listByTherapist,
    { therapistId },
  );

  const removeMutation = useMutation(convexApi.mutations.ooo.remove);

  if (!ooos) {
    return <p className="text-sm text-muted-foreground">Loading out-of-office entries...</p>;
  }

  if (ooos.length === 0) {
    return <p className="text-sm text-muted-foreground">No out-of-office entries scheduled.</p>;
  }

  const today = new Date();

  async function handleRemove(id: string) {
    await removeMutation({ id });
  }

  return (
    <div className="space-y-2">
      {ooos.map((ooo) => {
        const isPast = isBefore(parseISO(ooo.endDate), today);
        return (
          <Card key={ooo._id} className={isPast ? "opacity-50" : ""}>
            <CardContent className="flex items-center justify-between p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {formatOooRange(ooo.startDate, ooo.startTime, ooo.endDate, ooo.endTime)}
                </p>
                {ooo.reason && (
                  <p className="text-xs text-muted-foreground">{ooo.reason}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isPast && <Badge variant="outline">Past</Badge>}
                {!isPast && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(ooo._id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRemove(ooo._id)}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
