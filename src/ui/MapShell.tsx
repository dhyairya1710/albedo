import type { BuildingFeature } from "../types/simulation";

export interface MapShellProps {
  buildings: BuildingFeature[];
  selectedBuildingId: string;
  activeHour: number;
}

/**
 * Placeholder map container owned by the `ui` branch (Teammate B).
 * Will host the MapLibre GL 3D neighborhood extrusion & cast-shadow canvas.
 */
export function MapShell({
  buildings,
  selectedBuildingId,
  activeHour,
}: MapShellProps) {
  return (
    <section
      aria-label="Map viewport placeholder"
      style={{
        border: "1px solid var(--border-hairline)",
        backgroundColor: "var(--bg-surface)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "var(--space-2)",
        }}
      >
        MapShell Placeholder (maplibre-gl mount target)
      </div>
      <div
        className="tabular-nums"
        style={{
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
        }}
      >
        Loaded {buildings.length} buildings · Target: <code>{selectedBuildingId}</code> · Hour:{" "}
        {String(activeHour).padStart(2, "0")}:00
      </div>
    </section>
  );
}
