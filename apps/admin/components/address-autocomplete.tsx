"use client";

import { useRef, useCallback } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { Input } from "@openschedule/ui/components/input";

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates: { lat: number; lng: number } | null) => void;
  placeholder?: string;
  id?: string;
}

export function AddressAutocomplete({ value, onChange, placeholder, id }: AddressAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;

    const formattedAddress = place.formatted_address ?? "";
    const location = place.geometry?.location;
    const coordinates = location
      ? { lat: location.lat(), lng: location.lng() }
      : null;

    onChange(formattedAddress, coordinates);
  }, [onChange]);

  // Fallback to plain input if no API key
  if (!apiKey) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        placeholder={placeholder ?? "Enter address"}
      />
    );
  }

  return (
    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        placeholder={placeholder ?? "Start typing an address..."}
      />
    </Autocomplete>
  );
}
