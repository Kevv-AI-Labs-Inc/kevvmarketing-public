import { ENV } from "../_core/env";
import { analyzeWithGoogle, geocodeWithGoogle } from "./googleProvider";
import type {
  AnalyzeRouteParams,
  EtaProvider,
  GeocodeResult,
  RouteAnalysisResult,
  RouteProvider,
} from "./types";

function normalizeProvider(raw: string | null | undefined): EtaProvider {
  if (raw === "none") return "none";
  return "google";
}

export function resolveRouteProvider(requested?: EtaProvider): RouteProvider {
  const preferred = requested ?? "google";
  const envPreferred = normalizeProvider(ENV.mapRouteProvider);
  const effective = preferred === "none" ? envPreferred : preferred;
  if (effective === "none") {
    throw new Error("Map route provider is disabled. Set MAP_ROUTE_PROVIDER=google.");
  }

  if (!ENV.googleMapsServerApiKey) {
    throw new Error("No map route provider is configured. Set GOOGLE_MAPS_SERVER_API_KEY.");
  }

  return "google";
}

export async function analyzeRoute(params: {
  provider?: EtaProvider;
  stops: AnalyzeRouteParams["stops"];
  optimizeWaypointOrder: boolean;
  departureTime?: Date;
}): Promise<RouteAnalysisResult> {
  resolveRouteProvider(params.provider);
  const sharedParams: AnalyzeRouteParams = {
    stops: params.stops,
    optimizeWaypointOrder: params.optimizeWaypointOrder,
    departureTime: params.departureTime,
  };

  return analyzeWithGoogle(sharedParams);
}

export async function geocodeAddress(params: {
  provider?: EtaProvider;
  address: string;
}): Promise<GeocodeResult> {
  resolveRouteProvider(params.provider);
  return geocodeWithGoogle(params.address);
}

export type {
  EtaProvider,
  GeocodeResult,
  RouteAnalysisResult,
  RouteStopInput,
} from "./types";
