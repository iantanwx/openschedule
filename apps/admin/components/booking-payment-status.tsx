"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Badge } from "@opencal/ui/components/badge";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@opencal/ui/components/alert-dialog";

interface BookingPaymentStatusProps {
  bookingId: string;
  venueId: string;
  orgId: string;
}

export function BookingPaymentStatus({
  bookingId,
  orgId,
}: BookingPaymentStatusProps) {
  const payment = useQuery(convexApi.queries.payments.getForBooking, {
    bookingId,
  });
  const methods = useQuery(convexApi.queries.paymentMethods.list, { orgId });
  const markedByUser = useQuery(
    convexApi.queries.users.getPublic,
    payment && payment.status === "paid" ? { id: payment.markedBy } : "skip",
  );

  const createPayment = useMutation(convexApi.mutations.payments.create);
  const voidPayment = useMutation(convexApi.mutations.payments.voidPayment);

  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeMethods = methods?.filter((m) => m.status === "active") ?? [];

  // Auto-select if only one method available
  const singleMethod = activeMethods.length === 1 ? activeMethods[0] : undefined;
  useEffect(() => {
    if (singleMethod && !selectedMethodId) {
      setSelectedMethodId(singleMethod._id);
    }
  }, [singleMethod, selectedMethodId]);

  async function handleMarkPaid() {
    if (!selectedMethodId) {
      toast.error("Please select a payment method");
      return;
    }
    setIsSubmitting(true);
    try {
      await createPayment({
        bookingId,
        paymentMethodId: selectedMethodId,
        reference: paymentReference || undefined,
      });
      toast.success("Booking marked as paid");
      setShowMarkPaid(false);
      setPaymentReference("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to mark as paid",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVoid() {
    if (!payment) return;
    setIsSubmitting(true);
    try {
      await voidPayment({ id: payment._id });
      toast.success("Payment voided");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to void payment",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (payment === undefined || methods === undefined) return null;

  // Payment exists and is paid — show status
  if (payment && payment.status === "paid") {
    const method = methods.find((m) => m._id === payment.paymentMethodId);
    return (
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Payment</span>
            <Badge variant="default">Paid</Badge>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={isSubmitting}>
                Void
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Void this payment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the payment as voided. The booking will show as
                  unpaid again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleVoid}>
                  Void Payment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          {method && <p>Method: {method.label}</p>}
          {payment.reference && <p>Reference: {payment.reference}</p>}
          <p>
            Marked by {markedByUser?.name ?? "..."} on{" "}
            {new Date(payment.markedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  }

  // No payment or voided — show mark as paid
  if (!showMarkPaid) {
    return (
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Payment</span>
          <Badge variant="outline">Unpaid</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowMarkPaid(true)}
        >
          Mark as Paid
        </Button>
      </div>
    );
  }

  // Mark as paid form
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">Mark as Paid</p>
      {activeMethods.length > 1 && (
        <div className="space-y-1">
          <Label htmlFor="pay-method" className="text-xs">
            Payment Method
          </Label>
          <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
            <SelectTrigger id="pay-method">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {activeMethods.map((m) => (
                <SelectItem key={m._id} value={m._id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="pay-ref" className="text-xs">
          Reference (optional)
        </Label>
        <Input
          id="pay-ref"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          placeholder="Transaction ID or transfer ref"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleMarkPaid} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Confirm"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowMarkPaid(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
