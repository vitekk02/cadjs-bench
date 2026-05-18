/**
 * Shared helpers for case-study builders.
 *
 * Why these exist: `SketchToBrepService.convertSketchToBrep()` returns a
 * tessellated Brep with no analytic `occBrep` string, so a circle profile
 * becomes a polygon and any operation downstream sees a faceted input. The
 * higher-level `convertSketchToProfiles()` path is what the starter UI uses;
 * it returns profile objects that carry the analytic `occBrep` alongside
 * the tessellated Brep. Use {@link sketchToProfile} for every case-study
 * sketch so the resulting solid keeps clean topological edges.
 */

import * as THREE from "three";
import { SketchToBrepService, type Brep, type Sketch } from "@vitekk02/cadjs";

export interface SketchProfile {
  brep: Brep;
  occBrep: string | undefined;
  /**
   * Where the profile was placed in world coordinates. The returned `brep`
   * is centred at the origin in its local frame; this offset is the world
   * position the caller should assign to the resulting `SceneElement`.
   */
  center: THREE.Vector3;
}

/**
 * Convert a closed sketch to a single profile, preserving analytic geometry
 * in the returned `occBrep` when available. Picks the outermost loop if the
 * sketch produces more than one profile.
 */
export async function sketchToProfile(sketch: Sketch): Promise<SketchProfile> {
  const result =
    await SketchToBrepService.getInstance().convertSketchToProfiles(sketch);
  if (!result.success || result.profiles.length === 0) {
    throw new Error(`sketch '${sketch.id}' produced no profiles`);
  }
  const outer = result.profiles.find((p) => p.isOuter) ?? result.profiles[0]!;
  return {
    brep: outer.brep,
    occBrep: outer.occBrep,
    center: new THREE.Vector3(outer.center.x, outer.center.y, outer.center.z),
  };
}
