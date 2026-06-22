"use client";

import { LoadScript } from "@react-google-maps/api";
import type { ReactNode } from "react";

const LIBRARIES: ("places")[] = ["places"];

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={LIBRARIES}>
      {children}
    </LoadScript>
  );
}
