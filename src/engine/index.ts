import type {
  BuildingFeature,
  Coordinates,
  HourlyIrradiance,
  SimulationEngine,
  SimulationInput,
  SimulationResult,
} from "../types/simulation";

/**
 * Placeholder engine implementation owned by the `engine` branch (Teammate A).
 * Replace these stubs with real Overpass/OSM, Open-Meteo, SunCalc, and Turf logic.
 */
export async function fetchNeighborhoodBuildings(
  center: Coordinates,
  radiusMeters = 250
): Promise<BuildingFeature[]> {
  void center;
  void radiusMeters;
  throw new Error(
    "fetchNeighborhoodBuildings is not implemented yet (engine branch). Set USE_MOCK_ENGINE = true for UI development."
  );
}

export async function fetchHourlyIrradiance(
  center: Coordinates,
  dateISO: string
): Promise<HourlyIrradiance[]> {
  void center;
  void dateISO;
  throw new Error(
    "fetchHourlyIrradiance is not implemented yet (engine branch). Set USE_MOCK_ENGINE = true for UI development."
  );
}

export function runSimulation(
  input: SimulationInput,
  irradiance: HourlyIrradiance[]
): SimulationResult {
  void input;
  void irradiance;
  throw new Error(
    "runSimulation is not implemented yet (engine branch). Set USE_MOCK_ENGINE = true for UI development."
  );
}

export const simulationEngine: SimulationEngine = {
  fetchNeighborhoodBuildings,
  fetchHourlyIrradiance,
  runSimulation,
};
