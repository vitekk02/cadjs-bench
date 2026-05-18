/**
 * Sweep latency, straight vs curved path. The profile is a small square so
 * the cost varies only with path length and curvature, not with profile
 * tessellation.
 */

import * as THREE from "three";
import { sweepBRep, type Brep } from "@vitekk02/cadjs";
import type { BenchScenario } from "../timing";
import { makeRectBrep } from "../fixtures";

interface SweepFixture {
  brep: Brep;
  pathPoints: { x: number; y: number; z: number }[];
}

function straightPath(
  length: number,
  segments: number,
): { x: number; y: number; z: number }[] {
  const points: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    points.push({ x: 0, y: 0, z: (i / segments) * length });
  }
  return points;
}

function helicalPath(
  turns: number,
  radius: number,
  height: number,
  segmentsPerTurn: number,
) {
  const total = Math.max(2, turns * segmentsPerTurn);
  const points: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i <= total; i++) {
    const t = i / total;
    points.push({
      x: Math.cos(t * turns * Math.PI * 2) * radius,
      y: Math.sin(t * turns * Math.PI * 2) * radius,
      z: t * height,
    });
  }
  return points;
}

export const sweepScenarios: BenchScenario[] = [
  {
    name: "sweep / straight path 100mm",
    group: "sweep",
    description:
      "Square 20mm profile swept along a straight 100mm path (8 segments).",
    setup: async (): Promise<SweepFixture> => ({
      brep: makeRectBrep(20, 20),
      pathPoints: straightPath(100, 8),
    }),
    run: async (ctx) => {
      const { brep, pathPoints } = ctx as SweepFixture;
      const result = await sweepBRep(
        brep,
        new THREE.Vector3(0, 0, 0),
        pathPoints,
      );
      if (!result.ok)
        throw new Error(`sweep straight failed: ${result.reason}`);
    },
    n: 15,
    warmups: 1,
  },
  {
    name: "sweep / helix 2 turns",
    group: "sweep",
    description:
      "Square 20mm profile swept along a 2-turn helix (32 path points).",
    setup: async (): Promise<SweepFixture> => ({
      brep: makeRectBrep(20, 20),
      pathPoints: helicalPath(2, 50, 100, 16),
    }),
    run: async (ctx) => {
      const { brep, pathPoints } = ctx as SweepFixture;
      const result = await sweepBRep(
        brep,
        new THREE.Vector3(0, 0, 0),
        pathPoints,
      );
      if (!result.ok) throw new Error(`sweep helix failed: ${result.reason}`);
    },
    n: 15,
    warmups: 1,
  },
];
