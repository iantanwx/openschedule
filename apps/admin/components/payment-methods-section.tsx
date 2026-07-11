"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { generatePayNowQRString, PAYNOW_LOGO_PATH } from "@opencal/lib/paynow-qr";
import { convexApi } from "@/lib/convex-api";
import { PaymentMethodForm } from "./payment-method-form";
import { Button } from "@opencal/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@opencal/ui/components/card";
import { Badge } from "@opencal/ui/components/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@opencal/ui/components/alert-dialog";

interface PaymentMethodsSectionProps {
  orgId: string;
}

export function PaymentMethodsSection({ orgId }: PaymentMethodsSectionProps) {
  const methods = useQuery(convexApi.queries.paymentMethods.list, { orgId });
  const deactivateMutation = useMutation(
    convexApi.mutations.paymentMethods.deactivate,
  );
  const reactivateMutation = useMutation(
    convexApi.mutations.paymentMethods.reactivate,
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const venuesUsingMethod = useQuery(
    convexApi.queries.paymentMethods.listVenuesUsingMethod,
    deactivatingId ? { id: deactivatingId } : "skip",
  );

  async function handleDeactivate() {
    if (!deactivatingId) return;
    try {
      await deactivateMutation({ id: deactivatingId });
      toast.success("Payment method deactivated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to deactivate",
      );
    } finally {
      setDeactivatingId(null);
    }
  }

  async function handleReactivate(id: string) {
    try {
      await reactivateMutation({ id });
      toast.success("Payment method reactivated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reactivate",
      );
    }
  }

  if (methods === undefined) return null;

  const editingMethod = editingId
    ? methods.find((m) => m._id === editingId)
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payment Methods</CardTitle>
        {!showForm && !editingId && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            Add Method
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <PaymentMethodForm orgId={orgId} onDone={() => setShowForm(false)} />
        )}

        {editingMethod && (
          <PaymentMethodForm
            orgId={orgId}
            initialData={{
              id: editingMethod._id,
              type: editingMethod.type,
              label: editingMethod.label,
              holderName: editingMethod.details?.holderName,
              bankName: editingMethod.details?.bankName,
              accountNumber: editingMethod.details?.accountNumber,
              reference: editingMethod.details?.reference,
              method: editingMethod.details?.method as "paynow" | undefined,
              identifierType: editingMethod.details?.identifierType as "phone" | "uen" | undefined,
              identifierValue: editingMethod.details?.identifierValue,
              imageId: editingMethod.details?.imageId,
              notes: editingMethod.details?.notes,
            }}
            onDone={() => setEditingId(null)}
          />
        )}

        {!showForm && !editingId && methods.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No payment methods configured. Add one to display payment
            instructions to customers.
          </p>
        )}

        {!showForm && !editingId && methods.length > 0 && (
          <div className="space-y-3">
            {methods.map((m) => {
              const qrString =
                m.type === "qr_code" &&
                m.details?.method === "paynow" &&
                m.details?.identifierValue
                  ? generatePayNowQRString({
                      proxyType: (m.details.identifierType as "phone" | "uen") ?? "phone",
                      proxyValue: m.details.identifierValue,
                      editable: true,
                    })
                  : null;

              return (
                <div
                  key={m._id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.label}</span>
                      <Badge variant="outline">
                        {m.type === "bank_account" ? "Bank Account" : "QR Code"}
                      </Badge>
                      {m.status === "inactive" && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    {m.type === "bank_account" && m.details?.bankName && (
                      <p className="text-sm text-muted-foreground">
                        {m.details.bankName} &mdash; {m.details.accountNumber}
                      </p>
                    )}
                    {m.type === "qr_code" && m.details?.method && (
                      <p className="text-sm text-muted-foreground">
                        {m.details.method === "paynow" ? "PayNow" : m.details.method}{" "}
                        ({m.details.identifierType === "phone" ? "Phone" : "UEN"}:{" "}
                        {m.details.identifierValue})
                      </p>
                    )}
                    <div className="flex gap-1 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(m._id)}
                      >
                        Edit
                      </Button>
                      {m.status === "active" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeactivatingId(m._id)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReactivate(m._id)}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                  {qrString && (
                    <div className="shrink-0 rounded border bg-white p-1">
                      <QRCodeSVG
                        value={qrString}
                        size={64}
                        level="H"
                        imageSettings={{
                          src: PAYNOW_LOGO_PATH,
                          x: undefined,
                          y: undefined,
                          height: 8,
                          width: 40,
                          excavate: true,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog
        open={!!deactivatingId}
        onOpenChange={(open) => {
          if (!open) setDeactivatingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate payment method?</AlertDialogTitle>
            <AlertDialogDescription>
              {venuesUsingMethod && venuesUsingMethod.length > 0 ? (
                <>
                  This payment method is in use by:{" "}
                  {venuesUsingMethod.map((v) => v.name).join(", ")}.
                  Deactivating will remove it from those venues.
                </>
              ) : (
                "This payment method will be hidden from venue selection. Historical payment records will be preserved."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
