"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@/lib/convex-api";
import { Button } from "@openschedule/ui/components/button";
import { Card, CardContent } from "@openschedule/ui/components/card";
import { ServiceForm } from "./service-form";

interface ServicesPageProps {
  orgSlug: string;
}

export function ServicesPage({ orgSlug }: ServicesPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [showArchived, setShowArchived] = useState(false);

  const org = useQuery(convexApi.queries.organizations.getBySlug, { slug: orgSlug });
  const services = useQuery(
    convexApi.queries.services.listAllByOrg,
    org ? { orgId: org._id } : "skip",
  );

  const archiveService = useMutation(convexApi.mutations.services.archive);
  const unarchiveService = useMutation(convexApi.mutations.services.unarchive);

  if (!org || services === undefined) {
    return <div className="p-4"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const activeServices = (services ?? []).filter((s) => s.status === "active");
  const archivedServices = (services ?? []).filter((s) => s.status === "archived");
  const displayedServices = showArchived ? archivedServices : activeServices;

  if (showForm || editingService) {
    return (
      <div className="p-4">
        <ServiceForm
          orgId={org._id}
          service={editingService}
          onClose={() => { setShowForm(false); setEditingService(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Services</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>Add Service</Button>
      </div>

      <div className="flex gap-2">
        <Button variant={showArchived ? "outline" : "default"} size="sm" onClick={() => setShowArchived(false)}>
          Active ({activeServices.length})
        </Button>
        <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(true)}>
          Archived ({archivedServices.length})
        </Button>
      </div>

      {displayedServices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showArchived ? "No archived services." : "No services yet. Add your first service."}
        </p>
      ) : (
        <div className="space-y-3">
          {displayedServices.map((service) => (
            <Card key={service._id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: service.color }} />
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.duration} min — ${(service.price / 100).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {service.status === "active" ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setEditingService(service)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => archiveService({ id: service._id as any })}>Archive</Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => unarchiveService({ id: service._id as any })}>Unarchive</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
