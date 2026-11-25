import { describe, expect, it } from "vitest";
import { simulationEngine } from "../../src/engine";
import {
  DEFAULT_MOCK_CENTER,
  mockSimulationEngine,
} from "../../src/mocks/mockSimulation";

describe("Albedo simulation contract sanity check", () => {
  it("exposes SimulationEngine interface and runs end-to-end mock simulation", async () => {
    expect(typeof simulationEngine.fetchNeighborhoodBuildings).toBe("function");
    expect(typeof simulationEngine.fetchHourlyIrradiance).toBe("function");
    expect(typeof simulationEngine.runSimulation).toBe("function");

    const buildings = await mockSimulationEngine.fetchNeighborhoodBuildings(
      DEFAULT_MOCK_CENTER,
      250
    );
    const irradiance = await mockSimulationEngine.fetchHourlyIrradiance(
      DEFAULT_MOCK_CENTER,
      "2027-03-21"
    );

    const target = buildings.find((b) => b.isTarget);
    expect(target).toBeDefined();
    expect(buildings.length).toBeGreaterThan(1);
    expect(irradiance).toHaveLength(24);

    const asphaltResult = mockSimulationEngine.runSimulation(
      {
        targetBuildingId: target!.id,
        buildings,
        dateISO: "2027-03-21",
        roofMaterial: "asphalt",
        panelEfficiency: 0.21,
        usableRoofRatio: 0.72,
      },
      irradiance
    );

    const coolRoofResult = mockSimulationEngine.runSimulation(
      {
        targetBuildingId: target!.id,
        buildings,
        dateISO: "2027-03-21",
        roofMaterial: "cool_roof",
        panelEfficiency: 0.21,
        usableRoofRatio: 0.72,
      },
      irradiance
    );

    expect(asphaltResult.hourly).toHaveLength(24);
    expect(asphaltResult.dailyKwhShaded).toBeGreaterThan(0);
    expect(asphaltResult.dailyKwhShaded).toBeLessThanOrEqual(
      asphaltResult.dailyKwhUnshaded
    );
    expect(coolRoofResult.avgAbsorbedHeatWm2).toBeLessThan(
      asphaltResult.avgAbsorbedHeatWm2
    );
    expect(coolRoofResult.coolRoofHeatReductionPercent).toBeGreaterThan(50);
  });
});
