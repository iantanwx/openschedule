"use client";

import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { Badge } from "@openschedule/ui/components/badge";
import { format, isBefore, parseISO } from "date-fns";

interface BlockoutListProps {
  therapistId: string;
  onEdit: (blockoutId: string) => void;
}

export function BlockoutList({ therapistId, onEdit }: BlockoutListProps) {
  const blockouts = useQuery(
    convexApi.queries.blockouts.listByTherapist,
    { therapistId },
  );

  const removeMutation = useMutation(convexApi.mutations.blockouts.remove);

  if (!blockouts) {
    return <p className="text-sm text-muted-foreground">Loading blockouts...</p>;
  }

  if (blockouts.length === 0) {
    return <p className="text-sm text-muted-foreground">No blockouts scheduled.</p>;
  }

  const today = new Date();

  async function handleRemove(id: string) {
    await removeMutation({ id });
  }

  return (
    <div className="space-y-2">
      {blockouts.map((blockout) => {
        const isPast = isBefore(parseISO(blockout.date), today);
        return (
          <Card key={blockout._id} className={isPast ? "opacity-50" : ""}>
            <CardContent className="flex items-center justify-between p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {format(parseISO(blockout.date), "EEE, MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {blockout.startTime} – {blockout.endTime}
                  {blockout.reason && ` · ${blockout.reason}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {isPast && <Badge variant="outline">Past</Badge>}
                {!isPast && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(blockout._id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRemove(blockout._id)}
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
