/**
 * Minimal Google Maps type declarations for legacy client pages that use the
 * Google Maps JavaScript API directly.
 */

declare namespace google.maps {
  class Map {
    constructor(container: HTMLElement, options?: MapOptions);
    setCenter(latLng: LatLngLiteral | LatLng): void;
    setZoom(zoom: number): void;
    fitBounds(bounds: LatLngBounds): void;
    getCenter(): LatLng | undefined;
    getZoom(): number;
    panTo(latLng: LatLngLiteral | LatLng): void;
    addListener(event: string, handler: (...args: unknown[]) => void): MapsEventListener;
    [key: string]: unknown; // allow extra methods
  }

  class Marker {
    constructor(opts?: MarkerOptions);
    setMap(map: Map | null): void;
    setPosition(latLng: LatLngLiteral): void;
    setTitle(title: string): void;
    addListener(event: string, handler: (...args: unknown[]) => void): MapsEventListener;
    getPosition(): LatLng | null;
  }

  class InfoWindow {
    constructor(opts?: { content?: string | HTMLElement; maxWidth?: number });
    open(opts?: { map?: Map; anchor?: Marker } | Map, anchor?: Marker): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
  }

  class Geocoder {
    geocode(
      request: { address?: string; location?: LatLngLiteral },
      callback: (results: GeocoderResult[], status: GeocoderStatus) => void
    ): void;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  class LatLngBounds {
    constructor(sw?: LatLngLiteral, ne?: LatLngLiteral);
    extend(point: LatLngLiteral | LatLng): LatLngBounds;
    contains(point: LatLngLiteral | LatLng): boolean;
    isEmpty(): boolean;
    getCenter(): LatLng;
  }

  class DirectionsService {
    route(
      request: DirectionsRequest,
      callback: (result: DirectionsResult | null, status: DirectionsStatus) => void
    ): void;
  }

  class DirectionsRenderer {
    constructor(opts?: { map?: Map; suppressMarkers?: boolean });
    setDirections(result: DirectionsResult): void;
    setMap(map: Map | null): void;
  }

  interface MapOptions {
    center?: LatLngLiteral;
    zoom?: number;
    mapTypeId?: string;
    styles?: unknown[];
    disableDefaultUI?: boolean;
    zoomControl?: boolean;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
  }

  interface MarkerOptions {
    position?: LatLngLiteral;
    map?: Map;
    title?: string;
    label?: string | { text: string; color?: string; fontSize?: string; fontWeight?: string };
    icon?: string | { url?: string; scaledSize?: Size; path?: unknown; fillColor?: string; fillOpacity?: number; strokeColor?: string; strokeWeight?: number; scale?: number; anchor?: unknown };
    animation?: number;
    draggable?: boolean;
    zIndex?: number;
  }

  class Polyline {
    constructor(opts?: PolylineOptions);
    setMap(map: Map | null): void;
    getPath(): unknown;
    setPath(path: LatLngLiteral[] | LatLng[]): void;
  }

  interface PolylineOptions {
    path?: LatLngLiteral[] | LatLng[];
    geodesic?: boolean;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    map?: Map;
    icons?: unknown[];
  }

  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  interface MapsEventListener {
    remove(): void;
  }

  interface GeocoderResult {
    geometry: { location: LatLng; viewport?: LatLngBounds };
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }

  type GeocoderStatus = "OK" | "ZERO_RESULTS" | "OVER_QUERY_LIMIT" | "REQUEST_DENIED" | "INVALID_REQUEST" | "UNKNOWN_ERROR" | "ERROR";

  interface DirectionsRequest {
    origin: LatLngLiteral | string;
    destination: LatLngLiteral | string;
    travelMode: TravelMode;
    waypoints?: Array<{ location: LatLngLiteral | string; stopover?: boolean }>;
    optimizeWaypoints?: boolean;
  }

  interface DirectionsResult {
    routes: Array<{
      legs: Array<{
        distance: { text: string; value: number };
        duration: { text: string; value: number };
        start_address: string;
        end_address: string;
        steps: unknown[];
      }>;
      overview_polyline: { points: string };
    }>;
  }

  type DirectionsStatus = "OK" | "NOT_FOUND" | "ZERO_RESULTS" | "MAX_WAYPOINTS_EXCEEDED" | "INVALID_REQUEST" | "OVER_QUERY_LIMIT" | "REQUEST_DENIED" | "UNKNOWN_ERROR";

  type TravelMode = "DRIVING" | "WALKING" | "BICYCLING" | "TRANSIT";

  const TravelMode: {
    DRIVING: TravelMode;
    WALKING: TravelMode;
    BICYCLING: TravelMode;
    TRANSIT: TravelMode;
  };

  const GeocoderStatus: {
    OK: GeocoderStatus;
    ZERO_RESULTS: GeocoderStatus;
    ERROR: GeocoderStatus;
  };

  const Animation: {
    BOUNCE: number;
    DROP: number;
  };

  class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  const SymbolPath: {
    CIRCLE: unknown;
    FORWARD_CLOSED_ARROW: unknown;
    FORWARD_OPEN_ARROW: unknown;
    BACKWARD_CLOSED_ARROW: unknown;
    BACKWARD_OPEN_ARROW: unknown;
  };

  namespace event {
    function addListener(instance: unknown, event: string, handler: (...args: unknown[]) => void): MapsEventListener;
    function addListenerOnce(instance: unknown, event: string, handler: (...args: unknown[]) => void): MapsEventListener;
    function removeListener(listener: MapsEventListener): void;
  }
}
