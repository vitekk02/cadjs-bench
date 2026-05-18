/**
 * Fillet latency, varying number of edges.
 *
 * `filletBRep` takes 1-based edge indices into OCC's
 * `TopTools_IndexedMapOfShape` for the input shape. A box has 12 edges, so
 * scenarios fillet 1, 4, and 12 of them. Radius is 5 mm against a 100 mm box,
 * which is well within the safe range (no self-intersection).
 */

import * as THREE from "three";
import { filletBRep, type SceneElement } from "@vitekk02/cadjs";
import type { BenchScenario } from "../timing";
import { makeBoxElement } from "../fixtures";

interface FilletFixture {
  element: SceneElement;
}

function makeFilletScenario(edgeCount: 1 | 4 | 12, radius = 5): BenchScenario {
  const indices = Array.from({ length: edgeCount }, (_, i) => i + 1);
  return {
    name: `fillet / ${edgeCount} edge${edgeCount === 1 ? "" : "s"}`,
    group: "fillet",
    description: `Fillet ${edgeCount} edge(s) of a 100mm cube at radius ${radius}mm.`,
    setup: async (): Promise<FilletFixture> => ({
      element: await makeBoxElement({ width: 100, height: 100, depth: 100 }),
    }),
    run: async (ctx) => {
      const { element } = ctx as FilletFixture;
      const result = await filletBRep(
        element.brep,
        new THREE.Vector3(0, 0, 0),
        indices,
        radius,
        element.occBrep,
      );
      if (!result.ok) {
        throw new Error(`filletBRep N=${edgeCount} failed: ${result.reason}`);
      }
    },
    n: 15,
    warmups: 1,
  };
}

export const filletScenarios: BenchScenario[] = [
  makeFilletScenario(1),
  makeFilletScenario(4),
  makeFilletScenario(12),
];
