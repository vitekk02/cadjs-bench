/**
 * Bracket case study: L-shape sketch → extrude → mounting hole.
 *
 * Demonstrates a multi-segment polygonal sketch (the L-profile is built from
 * straight lines, not a single primitive) feeding the extrude path, then a
 * boolean cut to add the mounting hole.
 */

import * as THREE from "three";
import {
  booleanOp,
  extrudeBRep,
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

const ARM_LENGTH = 80;
const ARM_THICKNESS = 20;
const PART_DEPTH = 30;
const HOLE_RADIUS = 6;
const HOLE_OFFSET = 60; // Distance from corner along the long arm

let idCounter = 0;
const newId = (): string => `bracket_${++idCounter}`;

async function buildLShapeSketch(): Promise<SceneElement> {
  // L-profile vertices, oriented so the corner is at origin and arms extend
  // along +X and +Y. Wound counter-clockwise so the face normal points +Z.
  const pts: { id: string; x: number; y: number }[] = [
    { id: "v0", x: 0, y: 0 },
    { id: "v1", x: ARM_LENGTH, y: 0 },
    { id: "v2", x: ARM_LENGTH, y: ARM_THICKNESS },
    { id: "v3", x: ARM_THICKNESS, y: ARM_THICKNESS },
    { id: "v4", x: ARM_THICKNESS, y: ARM_LENGTH },
    { id: "v5", x: 0, y: ARM_LENGTH },
  ];
  const points: SketchPrimitive[] = pts.map((p) => ({
    id: p.id,
    type: "point",
    x: p.x,
    y: p.y,
  }));
  const lines: SketchPrimitive[] = pts.map((_, i) => ({
    id: `l${i}`,
    type: "line",
    p1Id: pts[i]!.id,
    p2Id: pts[(i + 1) % pts.length]!.id,
  }));
  const sketch: Sketch = {
    id: "bracket_l_sketch",
    plane: XY,
    primitives: [...points, ...lines],
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
  if (!result.ok) throw new Error(`bracket extrude failed: ${result.reason}`);
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

async function buildHoleCylinder(): Promise<SceneElement> {
  const sketch: Sketch = {
    id: "bracket_hole_sketch",
    plane: XY,
    primitives: [
      { id: "h_c", type: "point", x: HOLE_OFFSET, y: ARM_THICKNESS / 2 },
      { id: "h_circle", type: "circle", centerId: "h_c", radius: HOLE_RADIUS },
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
  return extrudeProfile(profileEl, PART_DEPTH * 1.5);
}

async function cutHole(
  body: SceneElement,
  hole: SceneElement,
): Promise<SceneElement> {
  const elements = [body, hole];
  const ids = elements.map((e) => e.nodeId);
  const objectsMap = new Map<string, THREE.Object3D>();
  for (const e of elements) objectsMap.set(e.nodeId, new THREE.Group());

  const result = await booleanOp("difference", elements, ids, 200, objectsMap, {
    targetId: body.nodeId,
    toolIds: [hole.nodeId],
  });
  if (!result.ok) throw new Error(`bracket cut failed: ${result.reason}`);
  const newEl = result.value.updatedElements.find(
    (e) => e.nodeId !== body.nodeId && e.nodeId !== hole.nodeId,
  );
  if (!newEl) throw new Error("bracket cut: no result element");
  return newEl;
}

export async function buildBracket(): Promise<CaseStudy> {
  idCounter = 0;
  const stages: CaseStudyStage[] = [];

  const profile = await buildLShapeSketch();
  stages.push({
    id: "01-profile",
    label: "1. L-shape profile",
    description: `Six-vertex L-shape on the XY plane (${ARM_LENGTH} mm × ${ARM_LENGTH} mm, ${ARM_THICKNESS} mm thick).`,
    element: profile,
  });

  const body = await extrudeProfile(profile, PART_DEPTH);
  stages.push({
    id: "02-extruded",
    label: "2. Extruded body",
    description: `Profile extruded along +Z by ${PART_DEPTH} mm.`,
    element: body,
  });

  const hole = await buildHoleCylinder();
  const finished = await cutHole(body, hole);
  stages.push({
    id: "03-mounting-hole",
    label: "3. Mounting hole",
    description: `Through-hole (r = ${HOLE_RADIUS} mm) cut on the long arm by boolean difference.`,
    element: finished,
  });

  return {
    id: "bracket",
    name: "L-bracket",
    description:
      "A right-angle mounting bracket. Demonstrates a multi-segment polygonal sketch profile feeding extrude, then a boolean cut for the mounting hole.",
    stages,
  };
}
