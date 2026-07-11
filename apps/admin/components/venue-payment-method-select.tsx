"use client";

import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { Label } from "@opencal/ui/components/label";
import { Badge } from "@opencal/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";
import Link from "next/link";

interface VenuePaymentMethodSelectProps {
  venueId: string;
  orgId: string;
  orgSlug: string;
  currentPaymentMethodId?: string;
}

export function VenuePaymentMethodSelect({
  venueId,
  orgId,
  orgSlug,
  currentPaymentMethodId,
}: VenuePaymentMethodSelectProps) {
  const methods = useQuery(convexApi.queries.paymentMethods.list, { orgId });
  const setPaymentMethod = useMutation(convexApi.mutations.venues.setPaymentMethod);
  const clearPaymentMethod = useMutation(convexApi.mutations.venues.clearPaymentMethod);

  const activeMethods = methods?.filter((m) => m.status === "active") ?? [];
  const currentMethod = methods?.find((m) => m._id === currentPaymentMethodId);
  const isCurrentInactive = currentMethod?.status === "inactive";

  async function handleChange(value: string) {
    try {
      if (value === "none") {
        await clearPaymentMethod({ id: venueId as any });
        toast.success("Payment method removed");
      } else {
        await setPaymentMethod({ id: venueId as any, paymentMethodId: value as any });
        toast.success("Payment method updated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  if (methods === undefined) return null;

  if (methods.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <p className="text-sm text-muted-foreground">
          No payment methods configured.{" "}
          <Link href={`/${orgSlug}/settings`} className="underline">
            Add one in org settings
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="venue-pm-select">Payment Method</Label>
      {isCurrentInactive && (
        <Badge variant="destructive" className="ml-2">
          Current method inactive — please select a new one
        </Badge>
      )}
      <Select value={currentPaymentMethodId ?? "none"} onValueChange={handleChange}>
        <SelectTrigger id="venue-pm-select">
          <SelectValue placeholder="Select payment method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {activeMethods.map((m) => (
            <SelectItem key={m._id} value={m._id}>
              {m.label} ({m.type === "bank_account" ? "Bank" : "QR"})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
