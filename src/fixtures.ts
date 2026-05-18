/**
 * Test-geometry helpers for benchmark scenarios. Builds {@link SceneElement}
 * inputs through the public cadjs API so the operations under test see the
 * same shape of input that real consumer code would produce.
 *
 * Two paths:
 * - {@link makeBoxElement} extrudes a flat rectangular Brep into a 3D box.
 *   Used for boolean / fillet scenarios where a polyhedral input is enough.
 * - {@link makeCircleProfileElement} builds a circular profile through the
 *   sketch path so it carries an analytic occBrep. Used when the operation
 *   under test has different code paths for analytic vs tessellated inputs
 *   (notably fillet and sweep).
 */

import * as THREE from "three";
import {
  Brep,
  Face,
  Vertex,
  extrudeBRep,
  SketchSolverService,
  SketchToBrepService,
  nodeId,
  type SceneElement,
  type Sketch,
  type SketchPlane,
  type SketchPrimitive,
} from "@vitekk02/cadjs";

let elementCounter = 0;
const nextNodeId = () => nodeId(`bench_${++elementCounter}`);

/** Flat rectangular Brep on the XY plane, centred on origin. */
export function makeRectBrep(width: number, height: number): Brep {
  const w2 = width / 2;
  const h2 = height / 2;
  const v1 = new Vertex(-w2, -h2, 0);
  const v2 = new Vertex(w2, -h2, 0);
  const v3 = new Vertex(w2, h2, 0);
  const v4 = new Vertex(-w2, h2, 0);
  const face = new Face([v1, v2, v3, v4]);
  return new Brep([v1, v2, v3, v4], [], [face]);
}

/**
 * Flat polygon profile with `segments` evenly-spaced vertices around a circle
 * of given `radius`. Used to vary profile complexity for the extrude scenarios.
 */
export function makePolygonBrep(radius: number, segments: number): Brep {
  const verts: Vertex[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    verts.push(new Vertex(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  const face = new Face(verts);
  return new Brep(verts, [], [face]);
}

export interface BoxOptions {
  width?: number;
  height?: number;
  depth?: number;
  position?: { x?: number; y?: number; z?: number };
}

/** Build a 3D box `SceneElement` by extruding a flat rectangle. */
export async function makeBoxElement(
  opts: BoxOptions = {},
): Promise<SceneElement> {
  const width = opts.width ?? 100;
  const height = opts.height ?? 100;
  const depth = opts.depth ?? 100;
  const flat = makeRectBrep(width, height);
  const result = await extrudeBRep(flat, depth, 1, { x: 0, y: 0, z: 1 });
  if (!result.ok)
    throw new Error(`makeBoxElement: extrude failed: ${result.reason}`);
  const ext = result.value;
  const pos = opts.position ?? {};
  return {
    brep: ext.brep,
    nodeId: nextNodeId(),
    position: new THREE.Vector3(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0),
    occBrep: ext.occBrep,
    edgeGeometry: ext.edgeGeometry,
    faceGeometry: ext.faceGeometry,
    vertexPositions: ext.vertexPositions,
  };
}

const XY_PLANE: SketchPlane = {
  type: "XY",
  origin: new THREE.Vector3(0, 0, 0),
  normal: new THREE.Vector3(0, 0, 1),
  xAxis: new THREE.Vector3(1, 0, 0),
  yAxis: new THREE.Vector3(0, 1, 0),
};

/**
 * Build a closed sketch profile from a single circle. Used to produce
 * analytic-circle BRep inputs (the kernel preserves the circle as an OCC
 * `Geom_Circle`, not a polygon approximation).
 */
export async function makeCircleProfileElement(
  radius: number,
): Promise<SceneElement> {
  const sketch: Sketch = {
    id: "bench_circle_sketch",
    plane: XY_PLANE,
    primitives: [
      { id: "c0_center", type: "point", x: 0, y: 0 },
      { id: "c0", type: "circle", centerId: "c0_center", radius },
    ] as SketchPrimitive[],
    constraints: [],
    dof: 0,
    status: "fully_constrained",
  };
  const brep =
    await SketchToBrepService.getInstance().convertSketchToBrep(sketch);
  return {
    brep,
    nodeId: nextNodeId(),
    position: new THREE.Vector3(0, 0, 0),
  };
}

/**
 * Build a closed sketch profile from `n` line segments forming a regular
 * polygon. Returned `SceneElement` carries the tessellated `Brep` only — used
 * to test extrude with profiles of varying primitive count.
 */
export async function makeLinePolygonProfileElement(
  radius: number,
  n: number,
): Promise<SceneElement> {
  const points: SketchPrimitive[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    points.push({
      id: `p${i}`,
      type: "point",
      x: Math.cos(a) * radius,
      y: Math.sin(a) * radius,
    });
  }
  const lines: SketchPrimitive[] = [];
  for (let i = 0; i < n; i++) {
    lines.push({
      id: `l${i}`,
      type: "line",
      p1Id: `p${i}`,
      p2Id: `p${(i + 1) % n}`,
    });
  }
  const sketch: Sketch = {
    id: "bench_polygon_sketch",
    plane: XY_PLANE,
    primitives: [...points, ...lines],
    constraints: [],
    dof: 0,
    status: "fully_constrained",
  };
  const brep =
    await SketchToBrepService.getInstance().convertSketchToBrep(sketch);
  return {
    brep,
    nodeId: nextNodeId(),
    position: new THREE.Vector3(0, 0, 0),
  };
}

/** Touch the sketch solver singleton to ensure planegcs is loaded. */
export async function warmSketchSolver(): Promise<void> {
  await SketchSolverService.getInstance().getGCS();
}
