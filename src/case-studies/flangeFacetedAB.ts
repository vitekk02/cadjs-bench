/**
 * A/B case study supporting the eval-flange paragraph that claims a
 * tessellated re-import would have produced a faceted side wall.
 *
 * Stage A: the same disk as the headline flange (analytic circle profile),
 * shown to confirm the smooth side wall.
 * Stage B: the same disk dimensions, but the profile is a 16-segment polygon
 * approximating the circle. The extruded body therefore has 16 flat side
 * faces and 32 sharp edges, which is the counterfactual the thesis paragraph
 * describes.
 *
 * The two stages are rendered side-by-side in the thesis as evidence that
 * analytic-profile preservation (occBrep round-trip) actually produces the
 * difference claimed in the prose.
 */

import * as THREE from "three";
import {
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

const DISK_RADIUS = 50;
const DISK_THICKNESS = 10;
const POLYGON_SIDES = 16;

let idCounter = 0;
const newId = (): string => `flange_ab_${++idCounter}`;

async function buildAnalyticDisk(): Promise<SceneElement> {
  const sketch: Sketch = {
    id: "flange_ab_analytic_sketch",
    plane: XY,
    primitives: [
      { id: "c", type: "point", x: 0, y: 0 },
      { id: "circle", type: "circle", centerId: "c", radius: DISK_RADIUS },
    ] as SketchPrimitive[],
    constraints: [],
    dof: 0,
    status: "fully_constrained",
  };
  const { brep, occBrep, center } = await sketchToProfile(sketch);
  const profile: SceneElement = {
    brep,
    nodeId: nodeId(newId()),
    position: center,
    occBrep,
  };
  return extrudeAlongZ(profile, DISK_THICKNESS);
}

async function buildPolygonalDisk(): Promise<SceneElement> {
  // Build a closed POLYGON_SIDES-vertex regular polygon inscribed in the
  // DISK_RADIUS circle. Each vertex is a sketch point, each side is a line
  // between two adjacent points. The conversion path is the same as for any
  // multi-segment sketch (no analytic circle to preserve).
  const primitives: SketchPrimitive[] = [];
  for (let i = 0; i < POLYGON_SIDES; i++) {
    const angle = (i / POLYGON_SIDES) * Math.PI * 2;
    primitives.push({
      id: `p${i}`,
      type: "point",
      x: Math.cos(angle) * DISK_RADIUS,
      y: Math.sin(angle) * DISK_RADIUS,
    });
  }
  for (let i = 0; i < POLYGON_SIDES; i++) {
    const a = `p${i}`;
    const b = `p${(i + 1) % POLYGON_SIDES}`;
    primitives.push({
      id: `l${i}`,
      type: "line",
      p1Id: a,
      p2Id: b,
    });
  }
  const sketch: Sketch = {
    id: "flange_ab_polygonal_sketch",
    plane: XY,
    primitives,
    constraints: [],
    dof: 0,
    status: "fully_constrained",
  };
  const { brep, occBrep, center } = await sketchToProfile(sketch);
  const profile: SceneElement = {
    brep,
    nodeId: nodeId(newId()),
    position: center,
    occBrep,
  };
  return extrudeAlongZ(profile, DISK_THICKNESS);
}

async function extrudeAlongZ(
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
  if (!result.ok)
    throw new Error(`flange A/B extrude failed: ${result.reason}`);
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

export async function buildFlangeFacetedAB(): Promise<CaseStudy> {
  idCounter = 0;
  const stages: CaseStudyStage[] = [];

  const analytic = await buildAnalyticDisk();
  stages.push({
    id: "01-analytic",
    label: "A. Analytic circle profile",
    description:
      "Disk extruded from an analytic circle sketch (r = 50 mm, h = 10 mm). " +
      "The side wall is a single cylindrical face; the silhouette is smooth.",
    element: analytic,
  });

  const polygonal = await buildPolygonalDisk();
  stages.push({
    id: "02-polygonal",
    label: "B. 16-segment polygon profile",
    description:
      `Same disk dimensions but the profile is a ${POLYGON_SIDES}-vertex ` +
      "regular polygon inscribed in the r = 50 mm circle. The side wall is " +
      `${POLYGON_SIDES} flat faces meeting at ${POLYGON_SIDES} sharp edges.`,
    element: polygonal,
  });

  return {
    id: "flange-ab",
    name: "Analytic vs. polygonal flange (A/B)",
    description:
      "Side-by-side comparison supporting the counterfactual in " +
      "Section eval-flange: an analytic-circle profile produces a smooth " +
      "cylindrical side wall, while a polygonal approximation produces a " +
      "faceted column with one flat face per profile segment.",
    stages,
  };
}
