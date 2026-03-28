import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { useT } from "@/i18n";
import { getUiCopy } from "@/i18n/ui-copy";
import { cn } from "@/lib/utils";

type LatLng = {
  lat: number;
  lng: number;
};

type MapUiProvider = "google" | "none";

type GoogleMapOptions = {
  zoom?: number;
  center?: LatLng;
  mapTypeControl?: boolean;
  fullscreenControl?: boolean;
  zoomControl?: boolean;
  streetViewControl?: boolean;
  mapId?: string;
};

type GoogleMapInstance = Record<string, unknown>;

type GoogleMapsApi = {
  maps?: {
    Map?: new (container: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

const MAP_UI_PROVIDER = (
  process.env.NEXT_PUBLIC_MAP_UI_PROVIDER?.trim().toLowerCase() || "google"
) as MapUiProvider;
const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() ?? "";

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js";

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapScript() {
  if (window.google?.maps) return Promise.resolve();
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error(
        "Google Maps API key is missing. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your frontend environment."
      )
    );
  }
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps script.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script."));
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsScriptPromise = null;
    throw error;
  });

  return googleMapsScriptPromise;
}

interface MapViewProps {
  className?: string;
  provider?: MapUiProvider;
  initialCenter?: LatLng;
  initialZoom?: number;
  onMapReady?: (map: GoogleMapInstance) => void;
}

export function MapView({
  className,
  provider = MAP_UI_PROVIDER,
  initialCenter = { lat: 40.7128, lng: -73.9060 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const { locale } = useT();
  const copy = getUiCopy(locale).map;
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMapInstance | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const init = usePersistFn(async () => {
    setErrorText(null);
    setIsLoading(true);

    try {
      if (provider === "none") {
        throw new Error(copy.providerDisabled);
      }
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error(copy.missingApiKey);
      }
      await loadGoogleMapScript();
      if (!mapContainer.current) {
        throw new Error(copy.containerMissing);
      }

      const googleMaps = window.google;
      if (!googleMaps?.maps?.Map) {
        throw new Error(copy.apiUnavailable);
      }

      map.current = new googleMaps.maps.Map(mapContainer.current, {
        zoom: initialZoom,
        center: initialCenter,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: true,
        mapId: GOOGLE_MAP_ID || undefined,
      });

      onMapReady?.(map.current);
    } catch (error) {
      let message =
        error instanceof Error
          ? error.message
          : copy.initFailed;
      if (message === "Failed to load Google Maps script.") {
        message = copy.scriptLoadFailed;
      }
      setErrorText(message);
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className={cn("relative h-[500px] w-full overflow-hidden bg-slate-100", className)}>
      <div ref={mapContainer} className="h-full w-full" />

      {isLoading && !errorText ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 text-sm text-slate-600">
          {copy.loading}
        </div>
      ) : null}

      {errorText ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 px-6 text-center">
          <div className="max-w-lg rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">
            {copy.loadFailedPrefix}
            {errorText}
          </div>
        </div>
      ) : null}
    </div>
  );
}
