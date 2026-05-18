/**
 * Sketch solver throughput, scaling primitive count and constraint count.
 *
 * Each scenario builds a regular polygon sketch with `n` line segments and
 * applies a fully-determining set of constraints (each segment equal-length,
 * adjacent segments perpendicular for the rectangle case, or no constraints
 * to leave it under-constrained). The solve cost grows with `n` and with
 * the constraint Jacobian size.
 */

import * as THREE from "three";
import {
  SketchSolverService,
  makeSketchConstraint,
  type Sketch,
  type SketchPlane,
  type SketchPrimitive,
  type SketchConstraint,
} from "@vitekk02/cadjs";
import type { BenchScenario } from "../timing";

const XY_PLANE: SketchPlane = {
  type: "XY",
  origin: new THREE.Vector3(0, 0, 0),
  normal: new THREE.Vector3(0, 0, 1),
  xAxis: new THREE.Vector3(1, 0, 0),
  yAxis: new THREE.Vector3(0, 1, 0),
};

interface SolverFixture {
  sketch: Sketch;
}

/**
 * Build a polygon sketch with `n` line segments. If `withEqualLength` is
 * true, add `n` equal-length constraints between adjacent edges, exercising
 * the planegcs Jacobian on a non-trivial constraint set.
 */
function buildPolygonSketch(
  n: number,
  radius: number,
  withEqualLength: boolean,
): Sketch {
  const primitives: SketchPrimitive[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    primitives.push({
      id: `p${i}`,
      type: "point",
      x: Math.cos(a) * radius,
      y: Math.sin(a) * radius,
    });
  }
  for (let i = 0; i < n; i++) {
    primitives.push({
      id: `l${i}`,
      type: "line",
      p1Id: `p${i}`,
      p2Id: `p${(i + 1) % n}`,
    });
  }

  const constraints: SketchConstraint[] = [];
  if (withEqualLength) {
    for (let i = 0; i < n; i++) {
      constraints.push(
        makeSketchConstraint(
          `eq${i}`,
          "equal",
          [`l${i}`, `l${(i + 1) % n}`],
          undefined,
          true,
        ),
      );
    }
  }

  return {
    id: `bench_solver_${n}_${withEqualLength ? "eq" : "free"}`,
    plane: XY_PLANE,
    primitives,
    constraints,
    dof: 0,
    status: "fully_constrained",
  };
}

function makeSolverScenario(
  n: number,
  withEqualLength: boolean,
): BenchScenario {
  const tag = withEqualLength ? "with equal-length" : "no constraints";
  return {
    name: `solver / ${n}-gon ${tag}`,
    group: "sketch solver",
    description: `Solve a polygon sketch of ${n} segments (${withEqualLength ? `${n} equal-length constraints` : "no constraints"}).`,
    setup: async (): Promise<SolverFixture> => ({
      sketch: buildPolygonSketch(n, 50, withEqualLength),
    }),
    run: async (ctx) => {
      const { sketch } = ctx as SolverFixture;
      await SketchSolverService.getInstance().solve(sketch);
    },
    n: 30,
    warmups: 2,
  };
}

export const sketchSolverScenarios: BenchScenario[] = [
  makeSolverScenario(8, false),
  makeSolverScenario(8, true),
  makeSolverScenario(32, true),
  makeSolverScenario(64, true),
];
