export type EtaProvider = "google" | "none";

export type RouteProvider = "google";

export type RouteStopInput = {
  listingKey: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

export type RouteLegResult = {
  fromStopIndex: number;
  toStopIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds: number | null;
  distanceText: string;
  durationText: string;
  durationInTrafficText: string | null;
};

export type RoutePathPoint = {
  latitude: number;
  longitude: number;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
};

export type RouteAnalysisResult = {
  provider: RouteProvider;
  optimizedOrder: number[];
  usedOptimization: boolean;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalDurationInTrafficSeconds: number | null;
  legs: RouteLegResult[];
  path: RoutePathPoint[];
};

export type AnalyzeRouteParams = {
  stops: RouteStopInput[];
  optimizeWaypointOrder: boolean;
  departureTime?: Date;
};
