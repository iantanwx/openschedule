"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@opencal/ui/components/button";
import { Input } from "@opencal/ui/components/input";
import { Label } from "@opencal/ui/components/label";
import { Calendar } from "@opencal/ui/components/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@opencal/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@opencal/ui/components/select";

interface NewBookingSheetProps {
  orgSlug: string;
  venueId: string;
  onClose: () => void;
}

type Step = "service" | "therapist" | "date" | "slot" | "customer";

export function NewBookingSheet({ orgSlug, venueId, onClose }: NewBookingSheetProps) {
  const [step, setStep] = useState<Step>("service");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const services = useQuery(
    convexApi.queries.services.listByOrg,
    org ? { orgId: org._id } : "skip",
  );
  const therapists = useQuery(
    convexApi.queries.therapistServices.listTherapistsByService,
    selectedServiceId ? { serviceId: selectedServiceId as any, venueId } : "skip",
  );

  const slots = useQuery(
    convexApi.queries.availability.getSlots,
    selectedTherapistId && selectedServiceId
      ? { venueId, therapistId: selectedTherapistId as any, serviceId: selectedServiceId as any }
      : "skip",
  );

  const createBooking = useMutation(convexApi.mutations.bookings.create);
  const getOrCreateCustomer = useMutation(convexApi.mutations.customers.getOrCreate);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const availableSlotsForDate = dateStr && slots ? (slots[dateStr] ?? []) : [];

  const availableDates = new Set(
    slots ? Object.keys(slots).filter((d) => {
      const daySlots = slots[d];
      return daySlots && daySlots.length > 0;
    }) : [],
  );

  async function handleSubmit() {
    if (!org || !selectedTherapistId || !dateStr || !selectedSlot) return;
    setIsSubmitting(true);
    try {
      const customerId = await getOrCreateCustomer({
        orgId: org._id,
        email: customerEmail,
        name: customerName,
        phone: customerPhone || undefined,
      });

      await createBooking({
        venueId,
        therapistId: selectedTherapistId,
        customerId,
        date: dateStr,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        createdBy: "owner",
        ...(selectedServiceId ? { serviceId: selectedServiceId } : {}),
      });

      onClose();
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
        </DialogHeader>

        {/* Step 0: Pick service */}
        {step === "service" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Select a service</p>
            {(services ?? []).map((service: any) => (
              <Button
                key={service._id}
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => { setSelectedServiceId(service._id); setStep("therapist"); }}
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: service.color }} />
                <span>{service.name}</span>
                <span className="ml-auto text-muted-foreground">{service.duration} min</span>
              </Button>
            ))}
          </div>
        )}

        {/* Step 1: Pick therapist */}
        {step === "therapist" && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Select a therapist</p>
            <Select
              value={selectedTherapistId ?? ""}
              onValueChange={(val) => {
                setSelectedTherapistId(val);
                setStep("date");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose therapist" />
              </SelectTrigger>
              <SelectContent>
                {(therapists ?? []).map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setStep("service")}>
              Back
            </Button>
          </div>
        )}

        {/* Step 2: Pick date */}
        {step === "date" && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Pick a date</p>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedSlot(null);
                setStep("slot");
              }}
              disabled={(date) => {
                const d = format(date, "yyyy-MM-dd");
                return !availableDates.has(d);
              }}
              className="rounded-md border"
            />
            <Button variant="outline" size="sm" onClick={() => setStep("therapist")}>
              Back
            </Button>
          </div>
        )}

        {/* Step 3: Pick slot */}
        {step === "slot" && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Pick a time</p>
            {availableSlotsForDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No slots available.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableSlotsForDate.map((slot) => (
                  <Button
                    key={slot.startTime}
                    variant={selectedSlot?.startTime === slot.startTime ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedSlot(slot);
                      setStep("customer");
                    }}
                  >
                    {slot.startTime}
                  </Button>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setStep("date")}>
              Back
            </Button>
          </div>
        )}

        {/* Step 4: Customer info */}
        {step === "customer" && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Customer details</p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="customer-name">Name</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="customer-phone">Phone (optional)</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                   placeholder="Phone number"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("slot")}>
                Back
              </Button>
              <Button
                size="sm"
                disabled={!customerName || !customerEmail || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Creating..." : "Create Booking"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
