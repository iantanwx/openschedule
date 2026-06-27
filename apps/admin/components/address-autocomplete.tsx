"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@opencal/ui/components/input";

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates: { lat: number; lng: number } | null, placeId: string | null) => void;
  placeholder?: string;
  id?: string;
}

export function AddressAutocomplete({ value, onChange, placeholder, id }: AddressAutocompleteProps) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(value);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;

    const formattedAddress = place.formatted_address ?? "";
    const location = place.geometry?.location;
    const coordinates = location
      ? { lat: location.lat(), lng: location.lng() }
      : null;
    const placeId = place.place_id ?? null;

    setInputValue(formattedAddress);
    onChange(formattedAddress, coordinates, placeId);
  }, [onChange]);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    // Create autocomplete instance once the places library is loaded
    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "place_id"],
    });
    autocomplete.addListener("place_changed", handlePlaceChanged);
    autocompleteRef.current = autocomplete;

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
      autocompleteRef.current = null;
    };
  }, [places, handlePlaceChanged]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Fallback to plain input if no API key (APIProvider won't load)
  if (!apiKey) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value, null, null)}
        placeholder={placeholder ?? "Enter address"}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      id={id}
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
        onChange(e.target.value, null, null);
      }}
      placeholder={placeholder ?? "Start typing an address..."}
    />
  );
}
