/**
 * Extrude latency, varying profile complexity.
 *
 * The profile is a regular `n`-gon polygon Brep built directly (no sketch
 * round-trip), so the per-run cost is dominated by the OCC extrude call
 * itself rather than the fixture path.
 */

import { extrudeBRep, type Brep } from "@vitekk02/cadjs";
import type { BenchScenario } from "../timing";
import { makePolygonBrep } from "../fixtures";

interface ExtrudeFixture {
  brep: Brep;
}

function makeExtrudeScenario(
  segments: number,
  depth = 50,
  radius = 50,
): BenchScenario {
  return {
    name: `extrude / ${segments}-segment polygon`,
    group: "extrude",
    description: `Extrude an ${segments}-vertex polygonal profile by ${depth}mm.`,
    setup: async (): Promise<ExtrudeFixture> => ({
      brep: makePolygonBrep(radius, segments),
    }),
    run: async (ctx) => {
      const { brep } = ctx as ExtrudeFixture;
      const result = await extrudeBRep(brep, depth, 1, { x: 0, y: 0, z: 1 });
      if (!result.ok) {
        throw new Error(`extrude N=${segments} failed: ${result.reason}`);
      }
    },
    n: 15,
    warmups: 1,
  };
}

export const extrudeScenarios: BenchScenario[] = [
  makeExtrudeScenario(4),
  makeExtrudeScenario(16),
  makeExtrudeScenario(64),
];
