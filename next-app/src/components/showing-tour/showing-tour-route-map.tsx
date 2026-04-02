"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "@/components/Map";
import { cn } from "@/lib/utils";

type TourMapStop = {
  order: number;
  listingKey: string;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ShowingTourRouteMapProps = {
  stops: TourMapStop[];
  className?: string;
  emptyState: string;
};

type GoogleMapInstance = Record<string, unknown> & {
  fitBounds: (bounds: unknown, padding?: number) => void;
};

type GoogleMapMarker = {
  setMap?: (map: unknown) => void;
  map?: unknown;
};

type GoogleDirectionsRenderer = {
  setMap: (map: unknown) => void;
  setDirections: (result: unknown) => void;
};

type GoogleMapsNamespace = {
  LatLngBounds: new () => { extend: (point: { lat: number; lng: number }) => void };
  Marker: new (options: Record<string, unknown>) => GoogleMapMarker;
  TravelMode: { DRIVING: string };
  DirectionsService?: new () => {
    route: (
      request: Record<string, unknown>,
      callback: (result: unknown, status: string) => void
    ) => void;
  };
  DirectionsRenderer?: new (options: Record<string, unknown>) => GoogleDirectionsRenderer;
  marker?: {
    AdvancedMarkerElement?: new (options: Record<string, unknown>) => GoogleMapMarker;
  };
};

function normalizeCoordinate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildMarkerLabel(order: number) {
  return String(order);
}

function getGoogleMaps(): GoogleMapsNamespace | null {
  const googleRef = (window as unknown as { google?: { maps?: unknown } }).google?.maps;
  if (!googleRef || typeof googleRef !== "object") {
    return null;
  }
  return googleRef as GoogleMapsNamespace;
}

export function ShowingTourRouteMap({
  stops,
  className,
  emptyState,
}: ShowingTourRouteMapProps) {
  const [mapInstance, setMapInstance] = useState<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMapMarker[]>([]);
  const directionsRendererRef = useRef<GoogleDirectionsRenderer | null>(null);

  const coordinateStops = useMemo(
    () =>
      stops
        .map((stop) => ({
          ...stop,
          latitude: normalizeCoordinate(stop.latitude),
          longitude: normalizeCoordinate(stop.longitude),
        }))
        .filter(
          (stop): stop is TourMapStop & { latitude: number; longitude: number } =>
            stop.latitude !== null && stop.longitude !== null
        ),
    [stops]
  );

  useEffect(() => {
    const googleMaps = getGoogleMaps();
    const map = mapInstance;
    if (!googleMaps || !map) return;

    const clearRenderedRoute = () => {
      if (directionsRendererRef.current?.setMap) {
        directionsRendererRef.current.setMap(null);
      }
      directionsRendererRef.current = null;
      markersRef.current.forEach((marker) => {
        if (typeof marker?.setMap === "function") {
          marker.setMap(null);
        } else if (marker) {
          marker.map = null;
        }
      });
      markersRef.current = [];
    };

    clearRenderedRoute();

    if (coordinateStops.length === 0) return;

    const bounds = new googleMaps.LatLngBounds();
    coordinateStops.forEach((stop) => {
      bounds.extend({ lat: stop.latitude, lng: stop.longitude });
    });

    const createMarkers = () => {
      const nextMarkers: GoogleMapMarker[] = [];

      coordinateStops.forEach((stop) => {
        const labelText = buildMarkerLabel(stop.order);
        const advancedMarker = googleMaps.marker?.AdvancedMarkerElement;

        if (typeof advancedMarker === "function") {
          const markerEl = document.createElement("div");
          markerEl.className =
            "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#1F5A4A] text-xs font-semibold text-white shadow-md";
          markerEl.textContent = labelText;

          nextMarkers.push(
            new advancedMarker({
              map,
              position: { lat: stop.latitude, lng: stop.longitude },
              content: markerEl,
              title: stop.address ?? stop.listingKey,
            })
          );
          return;
        }

        nextMarkers.push(
          new googleMaps.Marker({
            map,
            position: { lat: stop.latitude, lng: stop.longitude },
            label: {
              text: labelText,
              color: "#ffffff",
              fontWeight: "700",
            },
            title: stop.address ?? stop.listingKey,
          })
        );
      });

      markersRef.current = nextMarkers;
    };

    if (
      coordinateStops.length >= 2 &&
      typeof googleMaps.DirectionsService === "function" &&
      typeof googleMaps.DirectionsRenderer === "function"
    ) {
      const directionsService = new googleMaps.DirectionsService();
      const directionsRenderer = new googleMaps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#1F5A4A",
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
      directionsRendererRef.current = directionsRenderer;

      directionsService.route(
        {
          origin: {
            lat: coordinateStops[0].latitude,
            lng: coordinateStops[0].longitude,
          },
          destination: {
            lat: coordinateStops[coordinateStops.length - 1].latitude,
            lng: coordinateStops[coordinateStops.length - 1].longitude,
          },
          waypoints: coordinateStops.slice(1, -1).map((stop) => ({
            location: { lat: stop.latitude, lng: stop.longitude },
            stopover: true,
          })),
          travelMode: googleMaps.TravelMode.DRIVING,
          optimizeWaypoints: false,
          provideRouteAlternatives: false,
        },
        (result: unknown, status: string) => {
          if (status === "OK" && result) {
            directionsRenderer.setDirections(result);
          } else {
            directionsRenderer.setMap(null);
            directionsRendererRef.current = null;
            map.fitBounds(bounds, 56);
          }
          createMarkers();
          if (!result) {
            map.fitBounds(bounds, 56);
          }
        }
      );
      return clearRenderedRoute;
    }

    createMarkers();
    map.fitBounds(bounds, 56);

    return clearRenderedRoute;
  }, [coordinateStops, mapInstance]);

  if (coordinateStops.length < 2) {
    return (
      <div
        className={cn(
          "flex h-[280px] items-center justify-center rounded-2xl border border-dashed bg-muted/10 px-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        {emptyState}
      </div>
    );
  }

  const initialCenter = {
    lat: coordinateStops[0].latitude,
    lng: coordinateStops[0].longitude,
  };

  return (
    <MapView
      className={cn("h-[280px] rounded-2xl border", className)}
      initialCenter={initialCenter}
      initialZoom={12}
      onMapReady={(map) => setMapInstance(map as GoogleMapInstance)}
    />
  );
}
