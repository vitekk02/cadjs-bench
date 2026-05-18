/**
 * Wheel-hub case study: revolved profile of a stepped axle.
 *
 * Gears are extruded toothed profiles, not revolves, so this case study
 * demonstrates the revolve operation on a more natural fit: a stepped
 * cylindrical hub. The cross-section sketch is a closed half-profile in the
 * XZ plane, and the revolve sweeps it 360° around the Z axis.
 */

import * as THREE from "three";
import {
  nodeId,
  revolveBRep,
  type SceneElement,
  type Sketch,
  type SketchPlane,
  type SketchPrimitive,
} from "@vitekk02/cadjs";
import type { CaseStudy, CaseStudyStage } from "./types";
import { sketchToProfile } from "./shared";

// Sketch plane is XZ so the profile lies in a half-plane bounded by the Z
// axis (the revolve axis). Y axis points "out of the page" of the sketch.
const XZ: SketchPlane = {
  type: "XZ",
  origin: new THREE.Vector3(0, 0, 0),
  normal: new THREE.Vector3(0, 1, 0),
  xAxis: new THREE.Vector3(1, 0, 0),
  yAxis: new THREE.Vector3(0, 0, 1),
};

let idCounter = 0;
const newId = (): string => `hub_${++idCounter}`;

/**
 * Stepped half-profile vertices in the (radial, axial) plane. The leftmost
 * edge sits on the revolve axis (radius = 0).
 */
const PROFILE_POINTS: { id: string; r: number; z: number }[] = [
  { id: "p0", r: 0, z: 0 }, // axis bottom
  { id: "p1", r: 30, z: 0 }, // bottom flange outer
  { id: "p2", r: 30, z: 8 }, // top of bottom flange
  { id: "p3", r: 12, z: 8 }, // step inward
  { id: "p4", r: 12, z: 40 }, // shaft top
  { id: "p5", r: 20, z: 40 }, // top flange outer
  { id: "p6", r: 20, z: 50 }, // top of top flange
  { id: "p7", r: 0, z: 50 }, // axis top
];

async function buildHubProfile(): Promise<SceneElement> {
  const points: SketchPrimitive[] = PROFILE_POINTS.map((p) => ({
    id: p.id,
    type: "point",
    x: p.r,
    y: p.z,
  }));
  const lines: SketchPrimitive[] = PROFILE_POINTS.map((_, i) => ({
    id: `l${i}`,
    type: "line",
    p1Id: PROFILE_POINTS[i]!.id,
    p2Id: PROFILE_POINTS[(i + 1) % PROFILE_POINTS.length]!.id,
  }));
  const sketch: Sketch = {
    id: "hub_profile_sketch",
    plane: XZ,
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

async function revolveAroundZ(profile: SceneElement): Promise<SceneElement> {
  const result = await revolveBRep(
    profile.brep,
    profile.position,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    Math.PI * 2,
    profile.occBrep,
    "one",
  );
  if (!result.ok) throw new Error(`hub revolve failed: ${result.reason}`);
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

export async function buildHub(): Promise<CaseStudy> {
  idCounter = 0;
  const stages: CaseStudyStage[] = [];

  const profile = await buildHubProfile();
  stages.push({
    id: "01-profile",
    label: "1. Half-profile sketch",
    description:
      "Stepped closed profile in the XZ plane. The leftmost edge sits on the Z axis (the revolve axis).",
    element: profile,
  });

  const solid = await revolveAroundZ(profile);
  stages.push({
    id: "02-revolved",
    label: "2. Revolved solid",
    description:
      "Profile revolved 360° around the Z axis to produce the stepped hub.",
    element: solid,
  });

  return {
    id: "hub",
    name: "Stepped hub",
    description:
      "A rotationally symmetric stepped hub. Demonstrates the revolve operation on a closed half-profile sketch.",
    stages,
  };
}
