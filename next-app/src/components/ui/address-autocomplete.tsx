"use client";

/**
 * AddressAutocomplete
 *
 * Wraps a plain Input with Google Places Autocomplete (US + CA addresses).
 * Falls back to a plain text input if NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is
 * not configured — no breakage in dev/staging environments.
 *
 * Usage:
 *   <AddressAutocomplete
 *     value={address}
 *     onChange={setAddress}
 *     placeholder="Enter property address..."
 *     inputClassName="h-12 border-white/10 ..."
 *   />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Minimal Places shape (avoids conflicts with existing google type decls) ──

interface PlacesAutocompleteInstance {
  addListener: (event: string, handler: () => void) => void;
  getPlace: () => {
    formatted_address?: string;
    geometry?: { location?: { lat: () => number; lng: () => number } };
  };
}

// Access window.google safely via unknown to avoid redeclare conflicts
function getGooglePlaces(): {
  Autocomplete: new (
    input: HTMLInputElement,
    options?: Record<string, unknown>,
  ) => PlacesAutocompleteInstance;
} | null {
  const g = (window as unknown as Record<string, unknown>).google as
    | { maps?: { places?: unknown } }
    | undefined;
  const places = g?.maps?.places;
  if (!places || typeof (places as Record<string, unknown>).Autocomplete !== "function") {
    return null;
  }
  return places as {
    Autocomplete: new (
      input: HTMLInputElement,
      options?: Record<string, unknown>,
    ) => PlacesAutocompleteInstance;
  };
}

// ─── Component ─────────────────────────────────────────────────

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (formattedAddress: string) => void;
  /** Callback that also provides lat/lng extracted from Google Places geometry. */
  onSelectWithGeo?: (data: { formattedAddress: string; latitude?: number; longitude?: number }) => void;
  placeholder?: string;
  /** className applied to the outer wrapper div (when Maps key is set) */
  className?: string;
  /** className applied directly to the <Input> element */
  inputClassName?: string;
  disabled?: boolean;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onSelectWithGeo,
  placeholder,
  className,
  inputClassName,
  disabled,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<PlacesAutocompleteInstance | null>(null);
  const [ready, setReady] = useState(false);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || acRef.current) return;
    const Places = getGooglePlaces();
    if (!Places) return;

    const ac = new Places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: ["us", "ca"] },
      fields: ["formatted_address", "geometry"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const addr = place.formatted_address ?? "";
      if (addr) {
        onChange(addr);
        onSelect?.(addr);
        // Extract geometry if available
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();
        onSelectWithGeo?.({
          formattedAddress: addr,
          latitude: typeof lat === "number" && Number.isFinite(lat) ? lat : undefined,
          longitude: typeof lng === "number" && Number.isFinite(lng) ? lng : undefined,
        });
      }
    });

    acRef.current = ac;
  }, [onChange, onSelect, onSelectWithGeo]);

  // Init after script loads
  useEffect(() => {
    if (ready) initAutocomplete();
  }, [ready, initAutocomplete]);

  // Init if google was already on window before this component mounted
  useEffect(() => {
    if (getGooglePlaces()) initAutocomplete();
  }, [initAutocomplete]);

  // ── No API key → plain input fallback ────────────────────────
  if (!MAPS_KEY) {
    return (
      <Input
        className={inputClassName ?? className}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // ── With API key → load script + attach autocomplete ─────────
  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`}
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div className={`relative ${className ?? ""}`}>
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-40" />
        <Input
          ref={inputRef}
          className={`pl-9 ${inputClassName ?? ""}`}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </>
  );
}
