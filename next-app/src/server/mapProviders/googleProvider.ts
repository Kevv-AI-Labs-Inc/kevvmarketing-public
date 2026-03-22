import { ENV } from "../_core/env";
import { formatDistance, formatDuration } from "./format";
import type {
  AnalyzeRouteParams,
  GeocodeResult,
  RouteAnalysisResult,
  RoutePathPoint,
} from "./types";

function decodePolyline(encoded: string): RoutePathPoint[] {
  if (!encoded) return [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const points: RoutePathPoint[] = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    latitude += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    longitude += deltaLng;

    points.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return points;
}

function createIdentityMiddleOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

type GoogleDirectionsResponse = {
  status?: string;
  error_message?: string;
  routes?: Array<{
    legs?: Array<{
      distance?: { value?: number; text?: string };
      duration?: { value?: number; text?: string };
      duration_in_traffic?: { value?: number; text?: string };
    }>;
    waypoint_order?: number[];
    overview_polyline?: { points?: string };
  }>;
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

async function fetchGoogleJson(url: URL): Promise<GoogleDirectionsResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.mapRouteRequestTimeoutMs);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeWithGoogle(
  params: AnalyzeRouteParams
): Promise<RouteAnalysisResult> {
  const apiKey = ENV.googleMapsServerApiKey;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_MAPS_SERVER_API_KEY is not configured for server-side route analysis."
    );
  }

  const { stops } = params;
  if (stops.length < 2) {
    throw new Error("At least 2 stops are required to analyze a route.");
  }

  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const middleStops = stops.slice(1, -1);

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", apiKey);

  if (middleStops.length > 0) {
    const waypoints = middleStops
      .map((item) => `${item.latitude},${item.longitude}`)
      .join("|");
    if (params.optimizeWaypointOrder) {
      url.searchParams.set("waypoints", `optimize:true|${waypoints}`);
    } else {
      url.searchParams.set("waypoints", waypoints);
    }
  }

  const payload = await fetchGoogleJson(url);

  if (!payload || payload.status !== "OK" || !Array.isArray(payload.routes)) {
    const status = typeof payload?.status === "string" ? payload.status : "UNKNOWN";
    const message =
      typeof payload?.error_message === "string" ? payload.error_message : "";
    throw new Error(
      `Google Directions API error: ${status}${message ? ` - ${message}` : ""}`
    );
  }

  const route = payload.routes[0];
  if (!route || !Array.isArray(route.legs)) {
    throw new Error("Google Directions API returned no usable route.");
  }

  const middleIdentity = createIdentityMiddleOrder(middleStops.length);
  const waypointOrder =
    Array.isArray(route.waypoint_order) &&
    route.waypoint_order.length === middleStops.length &&
    route.waypoint_order.every((idx: unknown) => typeof idx === "number")
      ? (route.waypoint_order as number[])
      : middleIdentity;

  const optimizedOrder =
    stops.length === 2
      ? [0, 1]
      : [0, ...waypointOrder.map((idx) => idx + 1), stops.length - 1];

  const usedOptimization =
    params.optimizeWaypointOrder &&
    waypointOrder.length > 0 &&
    waypointOrder.some((idx, pos) => idx !== pos);

  const legs = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let totalDurationInTrafficSeconds = 0;
  let trafficLegCount = 0;

  for (let i = 0; i < route.legs.length; i += 1) {
    const leg = route.legs[i];
    const fromStopIndex = optimizedOrder[i];
    const toStopIndex = optimizedOrder[i + 1];
    if (fromStopIndex === undefined || toStopIndex === undefined) continue;

    const distanceMeters = Number(leg?.distance?.value ?? 0);
    const durationSeconds = Number(leg?.duration?.value ?? 0);
    const durationInTrafficValue = leg?.duration_in_traffic?.value;
    const durationInTrafficSeconds =
      typeof durationInTrafficValue === "number" && Number.isFinite(durationInTrafficValue)
        ? durationInTrafficValue
        : null;

    totalDistanceMeters += Number.isFinite(distanceMeters) ? distanceMeters : 0;
    totalDurationSeconds += Number.isFinite(durationSeconds) ? durationSeconds : 0;
    if (durationInTrafficSeconds !== null) {
      totalDurationInTrafficSeconds += durationInTrafficSeconds;
      trafficLegCount += 1;
    }

    legs.push({
      fromStopIndex,
      toStopIndex,
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : 0,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
      durationInTrafficSeconds,
      distanceText:
        typeof leg?.distance?.text === "string"
          ? leg.distance.text
          : formatDistance(distanceMeters),
      durationText:
        typeof leg?.duration?.text === "string"
          ? leg.duration.text
          : formatDuration(durationSeconds),
      durationInTrafficText:
        typeof leg?.duration_in_traffic?.text === "string"
          ? leg.duration_in_traffic.text
          : durationInTrafficSeconds !== null
          ? formatDuration(durationInTrafficSeconds)
          : null,
    });
  }

  const encodedPolyline =
    typeof route?.overview_polyline?.points === "string"
      ? route.overview_polyline.points
      : "";
  const decodedPath = decodePolyline(encodedPolyline);

  return {
    provider: "google",
    optimizedOrder,
    usedOptimization,
    totalDistanceMeters,
    totalDurationSeconds,
    totalDurationInTrafficSeconds:
      trafficLegCount === legs.length ? totalDurationInTrafficSeconds : null,
    legs,
    path:
      decodedPath.length > 0
        ? decodedPath
        : optimizedOrder.map((index) => ({
            latitude: stops[index].latitude,
            longitude: stops[index].longitude,
          })),
  };
}

export async function geocodeWithGoogle(address: string): Promise<GeocodeResult> {
  const apiKey = ENV.googleMapsServerApiKey;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_SERVER_API_KEY is not configured for geocoding.");
  }

  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error("Address is required for geocoding.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", trimmed);
  url.searchParams.set("key", apiKey);

  const payload = await fetchGoogleJson(url);
  if (!payload || payload.status !== "OK" || !Array.isArray(payload.results)) {
    const status = typeof payload?.status === "string" ? payload.status : "UNKNOWN";
    const message =
      typeof payload?.error_message === "string" ? payload.error_message : "";
    throw new Error(
      `Google Geocoding API error: ${status}${message ? ` - ${message}` : ""}`
    );
  }

  const first = payload.results[0];
  const location = first?.geometry?.location;
  const latitude = Number(location?.lat);
  const longitude = Number(location?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Google Geocoding API returned invalid location data.");
  }

  return {
    latitude,
    longitude,
    formattedAddress:
      typeof first?.formatted_address === "string" ? first.formatted_address : null,
  };
}
