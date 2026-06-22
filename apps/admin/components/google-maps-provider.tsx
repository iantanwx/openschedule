"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import type { ReactNode } from "react";

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <APIProvider apiKey={apiKey}>
      {children}
    </APIProvider>
  );
}
