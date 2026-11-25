import type { Polygon, Position } from "geojson";
import type {
  BuildingFeature,
  Coordinates,
  HourlyIrradiance,
  HourlySimulationPoint,
  RoofMaterial,
  ShadowPolygonFeature,
  SimulationEngine,
  SimulationInput,
  SimulationResult,
  SolarPosition,
} from "../types/simulation";

/** Default demo coordinate center (Ahmedabad urban block). */
export const DEFAULT_MOCK_CENTER: Coordinates = {
  lat: 23.0225,
  lng: 72.5714,
};

const ROOF_ALBEDO: Record<RoofMaterial, number> = {
  asphalt: 0.1,
  concrete: 0.28,
  terracotta: 0.34,
  cool_roof: 0.78,
};

const BASELINE_ALBEDO = ROOF_ALBEDO.asphalt;

function offsetPoint(
  center: Coordinates,
  eastMeters: number,
  northMeters: number
): Position {
  const latRad = (center.lat * Math.PI) / 180;
  const lat = center.lat + northMeters / 111_320;
  const lng = center.lng + eastMeters / (111_320 * Math.cos(latRad));
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

function makeRectPolygon(
  center: Coordinates,
  centerEastM: number,
  centerNorthM: number,
  widthM: number,
  depthM: number
): Polygon {
  const hw = widthM / 2;
  const hd = depthM / 2;
  const sw = offsetPoint(center, centerEastM - hw, centerNorthM - hd);
  const se = offsetPoint(center, centerEastM + hw, centerNorthM - hd);
  const ne = offsetPoint(center, centerEastM + hw, centerNorthM + hd);
  const nw = offsetPoint(center, centerEastM - hw, centerNorthM + hd);

  return {
    type: "Polygon",
    coordinates: [[sw, se, ne, nw, sw]],
  };
}

function computeSolarPosition(hour: number): SolarPosition {
  // Daylight window 06:00 - 18:00 with peak ~68 deg at 12:30
  if (hour < 6 || hour > 18) {
    return {
      altitudeRad: -0.2,
      azimuthRad: 0,
      altitudeDeg: -11.5,
      azimuthDeg: 0,
      isDaylight: false,
    };
  }

  const normalized = (hour - 6) / 12; // 0..1 across daytime
  const altitudeDeg = Math.max(2, Math.sin(normalized * Math.PI) * 68);
  const azimuthDeg = 75 + normalized * 210; // East (~75) -> South (180) -> West (~285)
  const altitudeRad = (altitudeDeg * Math.PI) / 180;
  const azimuthRad = (azimuthDeg * Math.PI) / 180;

  return {
    altitudeRad: Number(altitudeRad.toFixed(4)),
    azimuthRad: Number(azimuthRad.toFixed(4)),
    altitudeDeg: Number(altitudeDeg.toFixed(1)),
    azimuthDeg: Number(azimuthDeg.toFixed(1)),
    isDaylight: true,
  };
}

function projectBuildingShadow(
  building: BuildingFeature,
  effectiveHeight: number,
  solar: SolarPosition,
  hour: number,
  center: Coordinates
): ShadowPolygonFeature {
  const ring = building.footprint.coordinates[0];
  const clampedAltRad = Math.max(solar.altitudeRad, 0.14);
  const shadowLengthM = Math.min(effectiveHeight / Math.tan(clampedAltRad), 120);

  // Cast shadow opposite the sun's azimuth (azimuth measured clockwise from North)
  const shadowDirRad = solar.azimuthRad + Math.PI;
  const dxMeters = Math.sin(shadowDirRad) * shadowLengthM;
  const dyMeters = Math.cos(shadowDirRad) * shadowLengthM;

  const latRad = (center.lat * Math.PI) / 180;
  const dLat = dyMeters / 111_320;
  const dLng = dxMeters / (111_320 * Math.cos(latRad));

  // Build simplified convex quadrilateral connecting footprint bounds & shifted bounds
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const baseCorners: Position[] = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
  ];

  const shiftedCorners: Position[] = baseCorners.map(([lng, lat]) => [
    Number((lng + dLng).toFixed(6)),
    Number((lat + dLat).toFixed(6)),
  ]);

  // Order boundary cleanly around original + displaced corners via simple hull
  const allPoints = [...baseCorners, ...shiftedCorners];
  const hull = convexHull(allPoints);

  return {
    type: "Feature",
    properties: {
      sourceBuildingId: building.id,
      hour,
    },
    geometry: {
      type: "Polygon",
      coordinates: [hull],
    },
  };
}

function convexHull(points: Position[]): Position[] {
  const sorted = [...points].sort((a, b) =>
    a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]
  );

  const cross = (o: Position, a: Position, b: Position): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: Position[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Position[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  if (hull.length > 0) {
    hull.push(hull[0]);
  }
  return hull;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function fetchNeighborhoodBuildings(
  center: Coordinates,
  radiusMeters = 250
): Promise<BuildingFeature[]> {
  void radiusMeters;
  const specs: Array<{
    id: string;
    east: number;
    north: number;
    w: number;
    d: number;
    h: number;
    source: BuildingFeature["heightSource"];
    isTarget: boolean;
  }> = [
    {
      id: "bldg-target",
      east: 0,
      north: 0,
      w: 24,
      d: 18,
      h: 14,
      source: "osm_verified",
      isTarget: true,
    },
    {
      id: "bldg-tower-se",
      east: 34,
      north: -26,
      w: 22,
      d: 24,
      h: 34,
      source: "osm_verified",
      isTarget: false,
    },
    {
      id: "bldg-tower-sw",
      east: -32,
      north: -22,
      w: 20,
      d: 22,
      h: 28,
      source: "estimated_levels",
      isTarget: false,
    },
    {
      id: "bldg-east",
      east: 36,
      north: 12,
      w: 18,
      d: 20,
      h: 18,
      source: "osm_verified",
      isTarget: false,
    },
    {
      id: "bldg-west",
      east: -34,
      north: 14,
      w: 16,
      d: 18,
      h: 12,
      source: "estimated_levels",
      isTarget: false,
    },
    {
      id: "bldg-north",
      east: 4,
      north: 34,
      w: 26,
      d: 14,
      h: 9,
      source: "default_fallback",
      isTarget: false,
    },
  ];

  return specs.map((spec) => ({
    id: spec.id,
    footprint: makeRectPolygon(center, spec.east, spec.north, spec.w, spec.d),
    heightMeters: spec.h,
    heightSource: spec.source,
    areaSqMeters: spec.w * spec.d,
    isTarget: spec.isTarget,
  }));
}

export async function fetchHourlyIrradiance(
  center: Coordinates,
  dateISO: string
): Promise<HourlyIrradiance[]> {
  // Subtle deterministic latitude/date adjustment so UI date changes reflect cleanly
  const daySeed = Number(dateISO.slice(-2)) || 15;
  const seasonalFactor = 0.94 + ((daySeed % 10) / 100);
  const latFactor = Math.max(0.75, 1 - Math.abs(center.lat - 23) * 0.004);
  const scale = seasonalFactor * latFactor;

  return Array.from({ length: 24 }, (_, hour) => {
    if (hour < 6 || hour > 18) {
      return {
        hour,
        directNormal: 0,
        diffuseHorizontal: 0,
        globalTilted: 0,
      };
    }

    const normalized = (hour - 6) / 12;
    const bell = Math.sin(normalized * Math.PI);
    const directNormal = roundTo(860 * Math.pow(bell, 1.15) * scale, 1);
    const diffuseHorizontal = roundTo(145 * Math.pow(bell, 0.7) * scale, 1);
    const globalTilted = roundTo(directNormal * 0.9 + diffuseHorizontal, 1);

    return {
      hour,
      directNormal,
      diffuseHorizontal,
      globalTilted,
    };
  });
}

export function runSimulation(
  input: SimulationInput,
  irradiance: HourlyIrradiance[]
): SimulationResult {
  const target =
    input.buildings.find((b) => b.id === input.targetBuildingId) ??
    input.buildings.find((b) => b.isTarget) ??
    input.buildings[0];

  if (!target) {
    return {
      hourly: [],
      shadowPolygonsByHour: {},
      dailyKwhUnshaded: 0,
      dailyKwhShaded: 0,
      annualKwhEstimate: 0,
      shadingLossPercent: 0,
      avgAbsorbedHeatWm2: 0,
      coolRoofHeatReductionPercent: 0,
      annualCo2OffsetKg: 0,
      estimatedPaybackYears: 0,
    };
  }

  const firstCoord = target.footprint.coordinates[0]?.[0] ?? [
    DEFAULT_MOCK_CENTER.lng,
    DEFAULT_MOCK_CENTER.lat,
  ];
  const center: Coordinates = { lat: firstCoord[1], lng: firstCoord[0] };

  const effectiveHeight = (b: BuildingFeature): number =>
    input.heightOverrides?.[b.id] ?? b.heightMeters;

  const targetHeight = effectiveHeight(target);
  const usableAreaM2 = target.areaSqMeters * input.usableRoofRatio;
  const albedo = ROOF_ALBEDO[input.roofMaterial];
  const absorptance = 1 - albedo;
  const baselineAbsorptance = 1 - BASELINE_ALBEDO;

  // Measure relative neighbor obstruction factor using effective heights
  const neighborPressure = input.buildings
    .filter((b) => b.id !== target.id)
    .reduce((acc, b) => acc + Math.max(0, effectiveHeight(b) - targetHeight), 0);

  const shadowPolygonsByHour: Record<number, ShadowPolygonFeature[]> = {};
  const hourly: HourlySimulationPoint[] = [];

  let dailyKwhUnshaded = 0;
  let dailyKwhShaded = 0;
  let daylightHeatSum = 0;
  let daylightHours = 0;

  for (let hour = 0; hour < 24; hour++) {
    const irr = irradiance.find((item) => item.hour === hour) ?? {
      hour,
      directNormal: 0,
      diffuseHorizontal: 0,
      globalTilted: 0,
    };
    const solar = computeSolarPosition(hour);

    if (!solar.isDaylight || irr.globalTilted <= 0) {
      shadowPolygonsByHour[hour] = [];
      hourly.push({
        hour,
        solar,
        shadedFraction: 0,
        unshadedKw: 0,
        shadedKw: 0,
        absorbedHeatWm2: 0,
      });
      continue;
    }

    // Cast mock shadow polygons for every tall enough building
    shadowPolygonsByHour[hour] = input.buildings.map((b) =>
      projectBuildingShadow(b, effectiveHeight(b), solar, hour, center)
    );

    // Morning (7-10) and late afternoon (15-17) experience stronger neighbor shading
    const shoulderWeight =
      hour <= 10 ? (11 - hour) * 0.085 : hour >= 15 ? (hour - 14) * 0.095 : 0.03;
    const heightScale = Math.min(1.6, Math.max(0.25, neighborPressure / 45));
    const shadedFraction = roundTo(
      Math.min(0.82, Math.max(0, shoulderWeight * heightScale)),
      3
    );

    const unshadedKw = roundTo(
      usableAreaM2 * (irr.globalTilted / 1000) * input.panelEfficiency,
      2
    );
    const shadedKw = roundTo(unshadedKw * (1 - shadedFraction), 2);
    const effectiveIrradiance =
      irr.directNormal * (1 - shadedFraction) * 0.85 + irr.diffuseHorizontal;
    const absorbedHeatWm2 = roundTo(effectiveIrradiance * absorptance, 1);

    dailyKwhUnshaded += unshadedKw;
    dailyKwhShaded += shadedKw;
    daylightHeatSum += absorbedHeatWm2;
    daylightHours += 1;

    hourly.push({
      hour,
      solar,
      shadedFraction,
      unshadedKw,
      shadedKw,
      absorbedHeatWm2,
    });
  }

  dailyKwhUnshaded = roundTo(dailyKwhUnshaded, 2);
  dailyKwhShaded = roundTo(dailyKwhShaded, 2);

  const shadingLossPercent =
    dailyKwhUnshaded > 0
      ? roundTo(((dailyKwhUnshaded - dailyKwhShaded) / dailyKwhUnshaded) * 100, 1)
      : 0;

  const annualKwhEstimate = roundTo(dailyKwhShaded * 365 * 0.85, 0);
  const avgAbsorbedHeatWm2 =
    daylightHours > 0 ? roundTo(daylightHeatSum / daylightHours, 1) : 0;

  // Reduction achieved by current material relative to dark asphalt baseline (0% for asphalt -> ~75.6% for cool_roof)
  const coolRoofHeatReductionPercent = roundTo(
    ((baselineAbsorptance - absorptance) / baselineAbsorptance) * 100,
    1
  );

  const annualCo2OffsetKg = roundTo(annualKwhEstimate * 0.71, 0);

  // Assume ~$950/kWp installed cost and ~$0.12/kWh tariff for realistic mock payback
  const systemKwp = usableAreaM2 * input.panelEfficiency;
  const estimatedCapex = systemKwp * 950;
  const annualSavings = annualKwhEstimate * 0.12;
  const estimatedPaybackYears =
    annualSavings > 0 ? roundTo(estimatedCapex / annualSavings, 1) : 0;

  return {
    hourly,
    shadowPolygonsByHour,
    dailyKwhUnshaded,
    dailyKwhShaded,
    annualKwhEstimate,
    shadingLossPercent,
    avgAbsorbedHeatWm2,
    coolRoofHeatReductionPercent,
    annualCo2OffsetKg,
    estimatedPaybackYears,
  };
}

export const mockSimulationEngine: SimulationEngine = {
  fetchNeighborhoodBuildings,
  fetchHourlyIrradiance,
  runSimulation,
};
