"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import { Textarea } from "@opencal/ui/components/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@opencal/ui/components/card";
import { Switch } from "@opencal/ui/components/switch";
import { Spinner } from "@opencal/ui/components/spinner";

interface OrgSettingsFormProps {
  orgId: string;
}

export function OrgSettingsForm({ orgId }: OrgSettingsFormProps) {
  const settings = useQuery(convexApi.queries.settings.getByOrg, { orgId });
  const upsertSettings = useMutation(convexApi.mutations.settings.upsert);
  const generateUploadUrl = useMutation(convexApi.mutations.generateUploadUrl.generateUploadUrl);

  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [hideFromDirectory, setHideFromDirectory] = useState(false);
  const [logoStorageId, setLogoStorageId] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateOrg = useMutation(convexApi.mutations.organizations.update);
  const org = useQuery(convexApi.queries.organizations.get, { id: orgId });

  // Initialize form when settings load
  if (settings !== undefined && !isInitialized) {
    if (settings) {
      setBusinessName(settings.businessName);
      setContactEmail(settings.contactEmail ?? "");
      setContactPhone(settings.contactPhone ?? "");
      setEmailNotificationsEnabled(settings.emailNotificationsEnabled);
      setHideFromDirectory(settings.hideFromDirectory ?? false);
      setLogoStorageId(settings.logoStorageId);
      if (org) {
        setOrgDescription(org.description ?? "");
      }
    }
    setIsInitialized(true);
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      await upsertSettings({
        orgId: orgId as any,
        data: {
          businessName,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          logoStorageId: logoStorageId as any,
          emailNotificationsEnabled,
          hideFromDirectory,
        },
      });
      await updateOrg({
        id: orgId as any,
        description: orgDescription || undefined,
      });
      toast.success("Settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl({});

      // Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();
      setLogoStorageId(storageId);

      // Create local preview
      const previewUrl = URL.createObjectURL(file);
      setLogoPreviewUrl(previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemoveLogo() {
    setLogoStorageId(null);
    setLogoPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  if (settings === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Spinner size="sm" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Business Info */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Business Info</h4>

          <div className="space-y-1">
            <Label htmlFor="org-business-name">Business Name</Label>
            <Input
              id="org-business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your Business Name"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="org-contact-email">Contact Email</Label>
            <Input
              id="org-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@yourbusiness.com"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="org-contact-phone">Contact Phone</Label>
            <Input
              id="org-contact-phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+65 9123 4567"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="org-description">Description</Label>
            <Textarea
              id="org-description"
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              placeholder="Short description of your business (max 200 characters)"
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {orgDescription.length}/200
            </p>
          </div>

          {/* Logo upload */}
          <div className="space-y-2">
            <Label>Logo</Label>
            {(logoPreviewUrl || logoStorageId) && (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-md border bg-muted">
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      Logo
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveLogo}>
                  Remove
                </Button>
              </div>
            )}
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={isUploading}
            />
            {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Notifications</h4>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="text-sm font-medium">
                Email notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, booking confirmations, cancellations, and reschedules are emailed to the therapist and customer.
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotificationsEnabled}
              onCheckedChange={setEmailNotificationsEnabled}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="hide-from-directory" className="text-sm font-medium">
                Hide from directory
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, this organization will not appear in the public business directory.
              </p>
            </div>
            <Switch
              id="hide-from-directory"
              checked={hideFromDirectory}
              onCheckedChange={setHideFromDirectory}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button size="sm" disabled={isSaving} onClick={handleSave}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
