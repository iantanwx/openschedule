"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";
import { Card, CardContent, CardHeader, CardTitle } from "@opencal/ui/components/card";

interface ServiceFormProps {
  orgId: string;
  service?: {
    _id: string;
    name: string;
    slug: string;
    description: string;
    duration: number;
    price: number;
    color: string;
  } | null;
  onClose: () => void;
}

const DURATIONS = [30, 45, 60, 75, 90, 120];
const COLORS: Record<string, string> = {
  Indigo: "#4f46e5",
  Cyan: "#0891b2",
  Emerald: "#059669",
  Amber: "#d97706",
  Red: "#dc2626",
  Violet: "#7c3aed",
  Pink: "#db2777",
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ServiceForm({ orgId, service, onClose }: ServiceFormProps) {
  const [name, setName] = useState(service?.name ?? "");
  const [slug, setSlug] = useState(service?.slug ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(String(service?.duration ?? 60));
  const [price, setPrice] = useState(service ? String(service.price / 100) : "");
  const [color, setColor] = useState(service?.color ?? COLORS.Indigo ?? "#4f46e5");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createService = useMutation(convexApi.mutations.services.create);
  const updateService = useMutation(convexApi.mutations.services.update);

  const isEdit = !!service;

  function handleNameChange(value: string) {
    setName(value);
    if (!isEdit) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (isEdit) {
        await updateService({
          id: service._id as any,
          name,
          slug,
          description,
          duration: Number(duration),
          price: Math.round(Number(price) * 100),
          color,
        });
      } else {
        await createService({
          orgId: orgId as any,
          name,
          slug,
          description,
          duration: Number(duration),
          price: Math.round(Number(price) * 100),
          color,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Service" : "Add Service"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="service-name">Name</Label>
            <Input id="service-name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="service-slug">Slug</Label>
            <Input id="service-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="service-desc">Description</Label>
            <Input id="service-desc" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="service-duration">Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="service-duration"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="service-price">Price ($)</Label>
            <Input id="service-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Color</Label>
            <div className="flex gap-2">
              {Object.entries(COLORS).map(([colorName, hex]) => (
                <button key={hex} type="button" onClick={() => setColor(hex)}
                  className={`h-8 w-8 rounded-full border-2 ${color === hex ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: hex }} aria-label={colorName} />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : isEdit ? "Save" : "Create"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
