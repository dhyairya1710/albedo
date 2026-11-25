# AGENTS.md

## Project Summary

**Albedo** is a 100% client-side browser-based rooftop solar yield and urban heat island (UHI) simulator built with **Vite + React + TypeScript** for HackOut! 2027.

- Map rendering: `maplibre-gl`
- Spatial geometry & shadow intersection: `@turf/turf`
- Solar geometry: `suncalc`
- Icons: `lucide-react`
- Testing: `vitest`

All computation, shadow projection, irradiance modeling, and UI rendering happen directly in the browser with no custom backend server.

---

## Strict Branch Ownership Rules

To avoid merge conflicts between parallel feature branches, agents and contributors MUST obey these file boundaries:

1. **`engine` branch (Teammate A)**
   - **Owns:** `src/engine/**` and `tests/engine/**`
   - Must NOT modify `src/ui/**`, `src/App.tsx`, `src/styles/**`, or `docs/**`.

2. **`ui` branch (Teammate B)**
   - **Owns:** `src/ui/**`, `src/App.tsx`, `src/styles/**`, and `docs/**`
   - Must NOT modify `src/engine/**` or `tests/engine/**`.
   - Use `src/mocks/mockSimulation.ts` via the `USE_MOCK_ENGINE` flag during UI development until integrating with `src/engine/index.ts`.

3. **Shared Contract (`src/types/simulation.ts`)**
   - **`src/types/simulation.ts` is READ-ONLY on feature branches (`engine`, `ui`, etc.).**
   - **NEVER modify `src/types/simulation.ts` without explicit user approval.**
   - Any contract change must be proposed to the user and merged cleanly on `main`.

4. **Shared Mock (`src/mocks/mockSimulation.ts`)**
   - Conforms strictly to `SimulationEngine` in `src/types/simulation.ts`. Do not break its contract.

---

## Commands

- **Start dev server:** `npm run dev`
- **Typecheck & production build:** `npm run build`
- **Run test suite:** `npm test`

Always run `npm run build` and `npm test` before finishing changes in your branch scope.

---

## Design Rules

- **Aesthetic:** Dark, high-contrast minimalist editorial aesthetic.
- **Color Tokens:**
  - Primary background: `#0B0D10`
  - Solar gold accent: `#F5C990`
  - Use CSS custom properties defined in `src/styles/tokens.css` rather than hardcoding ad-hoc colors.
- **Data Visualization:** Crisp SVG telemetry with clean hairlines, tabular numerals, and clear contrast.
- **Restraint:** No neon glows, drop-shadow bloom, glassmorphic clutter, or bloated/gratuitous animations. Motion should be minimal, purposeful, and strictly legible.
