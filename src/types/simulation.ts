import type { Feature, Polygon } from "geojson";

/** Geographic coordinates in WGS84 decimal degrees. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** Provenance of a building's extruded height value. */
export type HeightSource =
  | "osm_verified"
  | "estimated_levels"
  | "default_fallback"
  | "user_override";

/** Extruded building footprint used for solar capture and shadow casting. */
export interface BuildingFeature {
  id: string;
  footprint: Polygon;
  heightMeters: number;
  heightSource: HeightSource;
  areaSqMeters: number;
  isTarget: boolean;
}

/** Supported rooftop surface material presets for thermal/albedo modeling. */
export type RoofMaterial = "asphalt" | "concrete" | "terracotta" | "cool_roof";

/** Solar position at a specific timestamp and location. */
export interface SolarPosition {
  altitudeRad: number;
  azimuthRad: number;
  altitudeDeg: number;
  azimuthDeg: number;
  isDaylight: boolean;
}

/** Hourly solar irradiance breakdown in W/m^2. */
export interface HourlyIrradiance {
  hour: number;
  directNormal: number;
  diffuseHorizontal: number;
  globalTilted: number;
}

/** Properties attached to a cast shadow GeoJSON polygon feature. */
export type ShadowPolygonProperties = {
  sourceBuildingId: string;
  hour: number;
};

/** Projected shadow polygon cast by a neighboring or self building at a given hour. */
export type ShadowPolygonFeature = Feature<Polygon, ShadowPolygonProperties>;

/** Per-hour simulation telemetry for the target rooftop. */
export interface HourlySimulationPoint {
  hour: number;
  solar: SolarPosition;
  shadedFraction: number;
  unshadedKw: number;
  shadedKw: number;
  absorbedHeatWm2: number;
}

/** Input payload for running a single-day solar yield and thermal simulation. */
export interface SimulationInput {
  targetBuildingId: string;
  buildings: BuildingFeature[];
  dateISO: string;
  roofMaterial: RoofMaterial;
  panelEfficiency: number;
  usableRoofRatio: number;
  heightOverrides?: Record<string, number>;
}

/** Aggregated daily/annual solar yield, shading loss, and UHI mitigation metrics. */
export interface SimulationResult {
  hourly: HourlySimulationPoint[];
  shadowPolygonsByHour: Record<number, ShadowPolygonFeature[]>;
  dailyKwhUnshaded: number;
  dailyKwhShaded: number;
  annualKwhEstimate: number;
  shadingLossPercent: number;
  avgAbsorbedHeatWm2: number;
  coolRoofHeatReductionPercent: number;
  annualCo2OffsetKg: number;
  estimatedPaybackYears: number;
}

/** Contract implemented by both the production engine and the UI mock engine. */
export interface SimulationEngine {
  fetchNeighborhoodBuildings(
    center: Coordinates,
    radiusMeters?: number
  ): Promise<BuildingFeature[]>;
  fetchHourlyIrradiance(
    center: Coordinates,
    dateISO: string
  ): Promise<HourlyIrradiance[]>;
  runSimulation(
    input: SimulationInput,
    irradiance: HourlyIrradiance[]
  ): SimulationResult;
}
