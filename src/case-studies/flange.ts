/**
 * Flange case study: outer disk → fillet → bolt-hole pattern.
 *
 * Demonstrates the four most-used CADjs feature operations end-to-end:
 *   1. Sketch + extrude (outer disk)
 *   2. Fillet (rounded outer edge)
 *   3. Boolean difference (six bolt holes through the disk)
 *
 * All stages are produced through the public `cadjs` API. The same part is
 * also buildable in the starter UI through ordinary sketch + extrude + fillet
 * + cut interactions.
 */

import * as THREE from "three";
import {
  booleanOp,
  extrudeBRep,
  filletBRep,
  nodeId,
  type SceneElement,
  type Sketch,
  type SketchPlane,
  type SketchPrimitive,
} from "@vitekk02/cadjs";
import type { CaseStudy, CaseStudyStage } from "./types";
import { sketchToProfile } from "./shared";

const XY: SketchPlane = {
  type: "XY",
  origin: new THREE.Vector3(0, 0, 0),
  normal: new THREE.Vector3(0, 0, 1),
  xAxis: new THREE.Vector3(1, 0, 0),
  yAxis: new THREE.Vector3(0, 1, 0),
};

const DISK_RADIUS = 50;
const DISK_THICKNESS = 10;
const FILLET_RADIUS = 2;
const BOLT_COUNT = 6;
const BOLT_CIRCLE_RADIUS = 35;
const BOLT_RADIUS = 4;

let idCounter = 0;
const newId = (): string => `flange_${++idCounter}`;

async function buildCircleSketch(
  radius: number,
  sketchId: string,
): Promise<SceneElement> {
  const sketch: Sketch = {
    id: sketchId,
    plane: XY,
    primitives: [
      { id: `${sketchId}_c`, type: "point", x: 0, y: 0 },
      {
        id: `${sketchId}_circle`,
        type: "circle",
        centerId: `${sketchId}_c`,
        radius,
      },
    ] as SketchPrimitive[],
    constraints: [],
    dof: 0,
    status: "fully_constrained",
  };
  const { brep, occBrep, center } = await sketchToProfile(sketch);
  return {
    brep,
    nodeId: nodeId(newId()),
    position: center,
    occBrep,
  };
}

async function extrudeProfile(
  profile: SceneElement,
  depth: number,
): Promise<SceneElement> {
  const result = await extrudeBRep(
    profile.brep,
    depth,
    1,
    { x: 0, y: 0, z: 1 },
    profile.occBrep,
  );
  if (!result.ok) throw new Error(`flange extrude failed: ${result.reason}`);
  const r = result.value;
  return {
    brep: r.brep,
    nodeId: nodeId(newId()),
    position: new THREE.Vector3(
      profile.position.x + r.positionOffset.x,
      profile.position.y + r.positionOffset.y,
      profile.position.z + r.positionOffset.z,
    ),
    occBrep: r.occBrep,
    edgeGeometry: r.edgeGeometry,
    faceGeometry: r.faceGeometry,
    vertexPositions: r.vertexPositions,
  };
}

async function filletAllOuterEdges(
  disk: SceneElement,
  radius: number,
): Promise<SceneElement> {
  // A short cylinder produced by extruding a circle has three OCC edges
  // (top circle, bottom circle, seam) — pick top and bottom (indices 1, 2).
  // Index 3 is the seam meridian and would fail.
  const result = await filletBRep(
    disk.brep,
    new THREE.Vector3(0, 0, 0),
    [1, 2],
    radius,
    disk.occBrep,
  );
  if (!result.ok) throw new Error(`flange fillet failed: ${result.reason}`);
  const r = result.value;
  return {
    brep: r.brep,
    nodeId: nodeId(newId()),
    position: new THREE.Vector3(
      disk.position.x + r.positionOffset.x,
      disk.position.y + r.positionOffset.y,
      disk.position.z + r.positionOffset.z,
    ),
    occBrep: r.occBrep,
    edgeGeometry: r.edgeGeometry,
    faceGeometry: r.faceGeometry,
    vertexPositions: r.vertexPositions,
  };
}

async function buildBoltCylinder(angle: number): Promise<SceneElement> {
  const x = Math.cos(angle) * BOLT_CIRCLE_RADIUS;
  const y = Math.sin(angle) * BOLT_CIRCLE_RADIUS;
  const sketch: Sketch = {
    id: `flange_bolt_${idCounter}_sketch`,
    plane: XY,
    primitives: [
      { id: `c${idCounter}`, type: "point", x, y },
      {
        id: `circ${idCounter}`,
        type: "circle",
        centerId: `c${idCounter}`,
        radius: BOLT_RADIUS,
      },
    ] as SketchPrimitive[],
    constraints: [],
    dof: 0,
    status: "fully_constrained",
  };
  const { brep, occBrep, center } = await sketchToProfile(sketch);
  const profileEl: SceneElement = {
    brep,
    nodeId: nodeId(newId()),
    position: center,
    occBrep,
  };
  return extrudeProfile(profileEl, DISK_THICKNESS * 1.5);
}

async function cutBoltPattern(disk: SceneElement): Promise<SceneElement> {
  const tools: SceneElement[] = [];
  for (let i = 0; i < BOLT_COUNT; i++) {
    tools.push(await buildBoltCylinder((i / BOLT_COUNT) * Math.PI * 2));
  }
  const elements = [disk, ...tools];
  const ids = elements.map((e) => e.nodeId);
  const objectsMap = new Map<string, THREE.Object3D>();
  for (const e of elements) objectsMap.set(e.nodeId, new THREE.Group());

  const result = await booleanOp("difference", elements, ids, 100, objectsMap, {
    targetId: disk.nodeId,
    toolIds: tools.map((t) => t.nodeId),
  });
  if (!result.ok) throw new Error(`flange bolt cut failed: ${result.reason}`);

  const newEl = result.value.updatedElements.find(
    (e) => e.nodeId !== disk.nodeId,
  );
  if (!newEl) throw new Error("flange bolt cut: no result element");
  return newEl;
}

export async function buildFlange(): Promise<CaseStudy> {
  idCounter = 0;
  const stages: CaseStudyStage[] = [];

  const profile = await buildCircleSketch(DISK_RADIUS, "flange_outer_sketch");
  stages.push({
    id: "01-profile",
    label: "1. Outer profile",
    description: "Closed circle on the XY sketch plane (r = 50 mm).",
    element: profile,
  });

  const disk = await extrudeProfile(profile, DISK_THICKNESS);
  stages.push({
    id: "02-disk",
    label: "2. Extruded disk",
    description: "Profile extruded along +Z by 10 mm.",
    element: disk,
  });

  const filleted = await filletAllOuterEdges(disk, FILLET_RADIUS);
  stages.push({
    id: "03-filleted",
    label: "3. Filleted edges",
    description: "Top and bottom circular edges rounded at r = 2 mm.",
    element: filleted,
  });

  const finished = await cutBoltPattern(filleted);
  stages.push({
    id: "04-bolts",
    label: "4. Bolt pattern",
    description: `Six through-holes (r = 4 mm) on a ${BOLT_CIRCLE_RADIUS} mm bolt circle, cut by boolean difference.`,
    element: finished,
  });

  return {
    id: "flange",
    name: "Bolted flange",
    description:
      "A standard mounting flange. Demonstrates sketch, extrude, fillet, and boolean difference end-to-end through the cadjs public API.",
    stages,
  };
}
