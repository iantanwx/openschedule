"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import { Textarea } from "@opencal/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";

interface PaymentMethodFormProps {
  orgId: string;
  initialData?: {
    id: string;
    type: "bank_account" | "qr_code";
    label: string;
    holderName?: string;
    bankName?: string;
    accountNumber?: string;
    reference?: string;
    method?: "paynow";
    identifierType?: "phone" | "uen";
    identifierValue?: string;
    imageId?: string;
    notes?: string;
  };
  onDone: () => void;
}

export function PaymentMethodForm({
  orgId,
  initialData,
  onDone,
}: PaymentMethodFormProps) {
  const isEditing = !!initialData;
  const [type, setType] = useState<"bank_account" | "qr_code">(
    initialData?.type ?? "bank_account",
  );
  const [label, setLabel] = useState(initialData?.label ?? "");
  // Bank fields
  const [holderName, setHolderName] = useState(initialData?.holderName ?? "");
  const [bankName, setBankName] = useState(initialData?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initialData?.accountNumber ?? "",
  );
  const [reference, setReference] = useState(initialData?.reference ?? "");
  // QR fields
  const [method, setMethod] = useState<"paynow">(initialData?.method ?? "paynow");
  const [identifierType, setIdentifierType] = useState<"phone" | "uen">(
    initialData?.identifierType ?? "phone",
  );
  const [identifierValue, setIdentifierValue] = useState(
    initialData?.identifierValue ?? "",
  );
  const [imageId, setImageId] = useState(initialData?.imageId ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const createMutation = useMutation(convexApi.mutations.paymentMethods.create);
  const updateMutation = useMutation(convexApi.mutations.paymentMethods.update);
  const generateUploadUrl = useMutation(
    convexApi.mutations.generateUploadUrl.generateUploadUrl,
  );

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = (await result.json()) as { storageId: string };
      setImageId(storageId);
      setImagePreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing && initialData) {
        await updateMutation({
          id: initialData.id,
          label: label.trim(),
          holderName:
            type === "bank_account" ? holderName || undefined : undefined,
          bankName:
            type === "bank_account" ? bankName || undefined : undefined,
          accountNumber:
            type === "bank_account" ? accountNumber || undefined : undefined,
          reference:
            type === "bank_account" ? reference || undefined : undefined,
          method: type === "qr_code" ? method || undefined : undefined,
          identifierType:
            type === "qr_code" ? identifierType || undefined : undefined,
          identifierValue:
            type === "qr_code" ? identifierValue || undefined : undefined,
          imageId: type === "qr_code" ? imageId || undefined : undefined,
          notes: type === "qr_code" ? notes || undefined : undefined,
        });
        toast.success("Payment method updated");
      } else {
        await createMutation({
          orgId,
          type,
          label: label.trim(),
          holderName:
            type === "bank_account" ? holderName || undefined : undefined,
          bankName:
            type === "bank_account" ? bankName || undefined : undefined,
          accountNumber:
            type === "bank_account" ? accountNumber || undefined : undefined,
          reference:
            type === "bank_account" ? reference || undefined : undefined,
          method: type === "qr_code" ? method || undefined : undefined,
          identifierType:
            type === "qr_code" ? identifierType || undefined : undefined,
          identifierValue:
            type === "qr_code" ? identifierValue || undefined : undefined,
          imageId: type === "qr_code" ? imageId || undefined : undefined,
          notes: type === "qr_code" ? notes || undefined : undefined,
        });
        toast.success("Payment method created");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditing && (
        <div className="space-y-2">
          <Label htmlFor="pm-type">Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as "bank_account" | "qr_code")}
          >
            <SelectTrigger id="pm-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_account">Bank Account</SelectItem>
              <SelectItem value="qr_code">QR Code</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="pm-label">Label</Label>
        <Input
          id="pm-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. OCBC Business or PayNow"
        />
      </div>

      {type === "bank_account" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="pm-holder">Account Holder Name</Label>
            <Input
              id="pm-holder"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-bank">Bank Name</Label>
            <Input
              id="pm-bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-account">Account Number</Label>
            <Input
              id="pm-account"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-reference">Reference / Instructions</Label>
            <Textarea
              id="pm-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Use booking ID as reference"
            />
          </div>
        </>
      )}

      {type === "qr_code" && (
        <>
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="pm-method">Provider</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as "paynow")}>
                <SelectTrigger id="pm-method" className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paynow">PayNow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-id-type">Type</Label>
              <Select value={identifierType} onValueChange={(v) => setIdentifierType(v as "phone" | "uen")}>
                <SelectTrigger id="pm-id-type" className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="uen">UEN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-id-value">
                {identifierType === "phone" ? "Phone" : "UEN"}
              </Label>
              <Input
                id="pm-id-value"
                value={identifierValue}
                onChange={(e) => setIdentifierValue(e.target.value)}
                placeholder={
                  identifierType === "phone" ? "+65 9123 4567" : "UEN number"
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-qr-image">QR Code Image</Label>
            <Input
              id="pm-qr-image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isUploading}
            />
            {imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt="QR preview"
                className="mt-2 h-32 w-32 rounded border object-contain"
              />
            )}
            {imageId && !imagePreviewUrl && (
              <p className="text-xs text-muted-foreground">Image uploaded</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-notes">Additional Notes</Label>
            <Textarea
              id="pm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional instructions"
            />
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
