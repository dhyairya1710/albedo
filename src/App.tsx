import { useEffect, useMemo, useState } from "react";
import { Building2, Sun, Thermometer } from "lucide-react";
import { simulationEngine } from "./engine";
import { DEFAULT_MOCK_CENTER, mockSimulationEngine } from "./mocks/mockSimulation";
import type {
  BuildingFeature,
  HourlyIrradiance,
  RoofMaterial,
  SimulationEngine,
  SimulationResult,
} from "./types/simulation";
import { MapShell } from "./ui/MapShell";

const USE_MOCK_ENGINE = true;

const ENGINE: SimulationEngine = USE_MOCK_ENGINE
  ? mockSimulationEngine
  : simulationEngine;

const ROOF_MATERIALS: Array<{ value: RoofMaterial; label: string }> = [
  { value: "asphalt", label: "Asphalt (0.10)" },
  { value: "concrete", label: "Concrete (0.28)" },
  { value: "terracotta", label: "Terracotta (0.34)" },
  { value: "cool_roof", label: "Cool Roof (0.78)" },
];

export default function App() {
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [irradiance, setIrradiance] = useState<HourlyIrradiance[]>([]);
  const [roofMaterial, setRoofMaterial] = useState<RoofMaterial>("asphalt");
  const [activeHour, setActiveHour] = useState<number>(12);
  const [error, setError] = useState<string | null>(null);

  const dateISO = "2027-03-21";

  useEffect(() => {
    let cancelled = false;

    async function loadBaseline() {
      try {
        setError(null);
        const [loadedBuildings, loadedIrradiance] = await Promise.all([
          ENGINE.fetchNeighborhoodBuildings(DEFAULT_MOCK_CENTER, 250),
          ENGINE.fetchHourlyIrradiance(DEFAULT_MOCK_CENTER, dateISO),
        ]);
        if (cancelled) return;
        setBuildings(loadedBuildings);
        setIrradiance(loadedIrradiance);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to initialize simulation.");
      }
    }

    void loadBaseline();
    return () => {
      cancelled = true;
    };
  }, [dateISO]);

  const targetBuilding = useMemo(
    () => buildings.find((b) => b.isTarget) ?? buildings[0],
    [buildings]
  );

  const result: SimulationResult | null = useMemo(() => {
    if (!targetBuilding || irradiance.length === 0) return null;
    return ENGINE.runSimulation(
      {
        targetBuildingId: targetBuilding.id,
        buildings,
        dateISO,
        roofMaterial,
        panelEfficiency: 0.21,
        usableRoofRatio: 0.72,
      },
      irradiance
    );
  }, [buildings, irradiance, roofMaterial, targetBuilding, dateISO]);

  const activePoint = result?.hourly.find((h) => h.hour === activeHour);
  const maxHourlyKw = useMemo(() => {
    if (!result) return 1;
    return Math.max(1, ...result.hourly.map((h) => h.unshadedKw));
  }, [result]);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-primary)",
        padding: "var(--space-6)",
        maxWidth: "1080px",
        margin: "0 auto",
        display: "grid",
        gap: "var(--space-6)",
        alignContent: "start",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "var(--space-4)",
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              fontSize: "0.75rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent-solar)",
            }}
          >
            <Sun size={14} strokeWidth={1.75} />
            <span>Albedo · Rooftop Solar &amp; UHI Simulator</span>
          </div>
          <h1
            style={{
              margin: "var(--space-1) 0 0",
              fontSize: "1.5rem",
              fontWeight: 500,
              letterSpacing: "-0.02em",
            }}
          >
            Neighborhood Yield &amp; Thermal Telemetry
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
          }}
        >
          <span
            style={{
              padding: "4px 8px",
              border: "1px solid var(--border-accent)",
              backgroundColor: "var(--accent-solar-muted)",
              color: "var(--accent-solar)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {USE_MOCK_ENGINE ? "MOCK ENGINE" : "LIVE ENGINE"}
          </span>
          <span className="tabular-nums">{dateISO}</span>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            padding: "var(--space-3) var(--space-4)",
            border: "1px solid var(--accent-heat)",
            color: "var(--accent-heat)",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      <MapShell
        buildings={buildings}
        selectedBuildingId={targetBuilding?.id ?? "none"}
        activeHour={activeHour}
      />

      <section
        aria-label="Simulation controls"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "var(--space-4)",
          padding: "var(--space-4)",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-hairline)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "var(--space-2)",
            }}
          >
            Roof Material Preset
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {ROOF_MATERIALS.map((mat) => {
              const active = mat.value === roofMaterial;
              return (
                <button
                  key={mat.value}
                  type="button"
                  onClick={() => setRoofMaterial(mat.value)}
                  style={{
                    cursor: "pointer",
                    padding: "6px 10px",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-sans)",
                    borderRadius: "var(--radius-sm)",
                    border: active
                      ? "1px solid var(--accent-solar)"
                      : "1px solid var(--border-hairline)",
                    backgroundColor: active
                      ? "var(--accent-solar-muted)"
                      : "var(--bg-elevated)",
                    color: active ? "var(--accent-solar)" : "var(--text-secondary)",
                  }}
                >
                  {mat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="hour-scrubber"
            className="tabular-nums"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "var(--space-2)",
            }}
          >
            <span>Solar Hour</span>
            <span style={{ color: "var(--accent-solar)" }}>
              {String(activeHour).padStart(2, "0")}:00
            </span>
          </label>
          <input
            id="hour-scrubber"
            type="range"
            min={6}
            max={18}
            step={1}
            value={activeHour}
            onChange={(e) => setActiveHour(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#F5C990" }}
          />
          {activePoint && (
            <div
              className="tabular-nums"
              style={{
                marginTop: "var(--space-1)",
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Shaded: {Math.round(activePoint.shadedFraction * 100)}% · Output:{" "}
              {activePoint.shadedKw.toFixed(1)} kW · Absorbed Heat:{" "}
              {activePoint.absorbedHeatWm2.toFixed(0)} W/m²
            </div>
          )}
        </div>
      </section>

      {result && (
        <>
          <section
            aria-label="Key metrics"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--space-3)",
            }}
          >
            <MetricCard
              icon={<Sun size={14} strokeWidth={1.75} />}
              label="Daily Shaded Yield"
              value={`${result.dailyKwhShaded.toFixed(1)} kWh`}
              sublabel={`Unshaded: ${result.dailyKwhUnshaded.toFixed(1)} kWh`}
              accent
            />
            <MetricCard
              icon={<Building2 size={14} strokeWidth={1.75} />}
              label="Shading Loss"
              value={`${result.shadingLossPercent.toFixed(1)}%`}
              sublabel={`Annual Est: ${result.annualKwhEstimate.toLocaleString()} kWh`}
            />
            <MetricCard
              icon={<Thermometer size={14} strokeWidth={1.75} />}
              label="Avg Absorbed Heat"
              value={`${result.avgAbsorbedHeatWm2.toFixed(1)} W/m²`}
              sublabel={`Cool-Roof Reduction: ${result.coolRoofHeatReductionPercent.toFixed(1)}%`}
            />
            <MetricCard
              icon={<Sun size={14} strokeWidth={1.75} />}
              label="CO₂ & Payback"
              value={`${result.annualCo2OffsetKg.toLocaleString()} kg/yr`}
              sublabel={`Est. Payback: ${result.estimatedPaybackYears.toFixed(1)} yrs`}
            />
          </section>

          <section
            aria-label="Hourly solar telemetry"
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-hairline)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3)",
                fontSize: "0.75rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <span>Hourly Output Telemetry (Unshaded vs Shaded kW)</span>
              <span style={{ color: "var(--text-secondary)" }}>06:00 — 18:00</span>
            </div>

            <svg
              viewBox="0 0 650 140"
              width="100%"
              height="140"
              role="img"
              aria-label="Hourly solar output bar chart"
            >
              <line
                x1="0"
                y1="115"
                x2="650"
                y2="115"
                stroke="rgba(244, 243, 238, 0.14)"
                strokeWidth="1"
              />
              {result.hourly
                .filter((point) => point.hour >= 6 && point.hour <= 18)
                .map((point, index) => {
                  const slotWidth = 50;
                  const x = index * slotWidth + 10;
                  const barWidth = 30;
                  const unshadedH = (point.unshadedKw / maxHourlyKw) * 95;
                  const shadedH = (point.shadedKw / maxHourlyKw) * 95;
                  const isActive = point.hour === activeHour;

                  return (
                    <g key={point.hour}>
                      <rect
                        x={x}
                        y={115 - unshadedH}
                        width={barWidth}
                        height={unshadedH}
                        fill="rgba(244, 243, 238, 0.1)"
                      />
                      <rect
                        x={x}
                        y={115 - shadedH}
                        width={barWidth}
                        height={shadedH}
                        fill={isActive ? "#F5C990" : "rgba(245, 201, 144, 0.55)"}
                      />
                      <text
                        x={x + barWidth / 2}
                        y={132}
                        textAnchor="middle"
                        fill={isActive ? "#F5C990" : "#6C7380"}
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {String(point.hour).padStart(2, "0")}
                      </text>
                    </g>
                  );
                })}
            </svg>
          </section>
        </>
      )}
    </main>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  accent?: boolean;
}

function MetricCard({ icon, label, value, sublabel, accent = false }: MetricCardProps) {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        backgroundColor: "var(--bg-surface)",
        border: accent
          ? "1px solid var(--border-accent)"
          : "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontSize: "0.75rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: accent ? "var(--accent-solar)" : "var(--text-muted)",
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div
        className="tabular-nums"
        style={{
          marginTop: "var(--space-2)",
          fontSize: "1.375rem",
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
      <div
        className="tabular-nums"
        style={{
          marginTop: "var(--space-1)",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
        }}
      >
        {sublabel}
      </div>
    </div>
  );
}
