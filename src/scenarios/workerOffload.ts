/**
 * Worker-offload effectiveness: while a heavy boolean is in flight, what
 * does the main-thread frame interval look like?
 *
 * The kernel work runs in the worker; the main thread only pays for
 * - sending the request (postMessage of serialised inputs)
 * - receiving the response (postMessage with transferable typed arrays)
 * - reconstructing Three.js BufferGeometry + Brep on resolve
 *
 * If the offload is doing its job, frame intervals during the op should stay
 * close to the idle baseline (~16.7 ms at 60 Hz). A regression would show up
 * as multi-frame stalls (50ms+) in the p95.
 *
 * The "scenario" reports a single result: median frame interval during a
 * heavy boolean, with the result's `runs_ms` field carrying every interval
 * for distribution plotting in the prose.
 */

import * as THREE from "three";
import { booleanOp, nodeId, type SceneElement } from "@vitekk02/cadjs";
import { makeBoxElement } from "../fixtures";
import type { BenchScenario } from "../timing";
import { measureFrameTimingDuring } from "../frameTimer";

interface OffloadFixture {
  template: SceneElement[];
}

async function buildHeavyOperands(): Promise<SceneElement[]> {
  return [
    await makeBoxElement({
      width: 100,
      height: 100,
      depth: 100,
      position: { x: 0, y: 0, z: 0 },
    }),
    await makeBoxElement({
      width: 100,
      height: 100,
      depth: 100,
      position: { x: 60, y: 30, z: 0 },
    }),
    await makeBoxElement({
      width: 100,
      height: 100,
      depth: 100,
      position: { x: 120, y: 0, z: 0 },
    }),
    await makeBoxElement({
      width: 100,
      height: 100,
      depth: 100,
      position: { x: 90, y: 60, z: 0 },
    }),
  ];
}

function cloneOperands(template: SceneElement[]) {
  const elements = template.map((t) => ({
    brep: t.brep,
    nodeId: nodeId(t.nodeId),
    position: t.position.clone(),
    occBrep: t.occBrep,
  }));
  const ids = elements.map((e) => e.nodeId);
  const objectsMap = new Map<string, THREE.Object3D>();
  for (const e of elements) objectsMap.set(e.nodeId, new THREE.Group());
  return { elements, ids, objectsMap };
}

/**
 * Run a single 4-way boolean union and record the rAF intervals during it.
 * Each "sample" returned by the timing harness corresponds to one full op,
 * but the meaningful data is in the frame intervals each op exposes — those
 * are merged into the `runs_ms` array via {@link mergeFrameIntervals}.
 */
const mergedIntervals: number[] = [];
const mergedLongTasks = { count: 0, total_ms: 0, max_ms: 0 };

function makeOffloadScenario(): BenchScenario {
  return {
    name: "worker offload / 4-way union",
    group: "worker offload",
    description:
      "Frame intervals (ms) measured during a 4-way boolean union. Lower median = main thread free. runs_ms holds every interval observed.",
    setup: async (): Promise<OffloadFixture> => {
      mergedIntervals.length = 0;
      mergedLongTasks.count = 0;
      mergedLongTasks.total_ms = 0;
      mergedLongTasks.max_ms = 0;
      return { template: await buildHeavyOperands() };
    },
    run: async (ctx) => {
      const { template } = ctx as OffloadFixture;
      const { elements, ids, objectsMap } = cloneOperands(template);
      const t = await measureFrameTimingDuring(async () => {
        const r = await booleanOp("union", elements, ids, 100, objectsMap);
        if (!r.ok) throw new Error(`offload boolean failed: ${r.reason}`);
      });
      // Push frame intervals into a side-channel so post-run reporting can
      // surface the distribution, not just the per-op wall-clock.
      mergedIntervals.push(...t.frameIntervals_ms);
      mergedLongTasks.count += t.longTasks.count;
      mergedLongTasks.total_ms += t.longTasks.total_ms;
      mergedLongTasks.max_ms = Math.max(
        mergedLongTasks.max_ms,
        t.longTasks.max_ms,
      );
    },
    n: 20,
    warmups: 1,
  };
}

/**
 * After the offload scenario has run, the merged frame-interval array is
 * available here. Tests/prose should read this directly rather than rely on
 * the BenchResult.runs_ms (which holds wall-clock per op, not frame-interval).
 */
export function getMergedFrameIntervals(): readonly number[] {
  return mergedIntervals;
}

export function getMergedLongTasks(): Readonly<{
  count: number;
  total_ms: number;
  max_ms: number;
}> {
  return mergedLongTasks;
}

export interface FrameIntervalStats {
  count: number;
  median_ms: number;
  p95_ms: number;
  min_ms: number;
  max_ms: number;
  /** Sample standard deviation (Bessel-corrected). */
  stddev_ms: number;
  /** First quartile (25th percentile). */
  q1_ms: number;
  /** Third quartile (75th percentile). */
  q3_ms: number;
  /** Interquartile range = q3 - q1. */
  iqr_ms: number;
  /** Fraction of intervals exceeding 33.3 ms (i.e. dropped below 30 fps). */
  fraction_over_33ms: number;
  /** Fraction of intervals exceeding 100 ms (visible stutter to the user). */
  fraction_over_100ms: number;
}

export function computeFrameIntervalStats(
  intervals: readonly number[] = mergedIntervals,
): FrameIntervalStats | null {
  if (intervals.length === 0) return null;
  const sorted = [...intervals].sort((a, b) => a - b);
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))]!;
  const over33 = sorted.filter((v) => v > 33.3).length;
  const over100 = sorted.filter((v) => v > 100).length;
  const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const variance =
    intervals.length > 1
      ? intervals.reduce((s, v) => s + (v - mean) ** 2, 0) /
        (intervals.length - 1)
      : 0;
  const q1 = at(0.25);
  const q3 = at(0.75);
  return {
    count: sorted.length,
    median_ms: at(0.5),
    p95_ms: at(0.95),
    min_ms: sorted[0]!,
    max_ms: sorted[sorted.length - 1]!,
    stddev_ms: Math.sqrt(variance),
    q1_ms: q1,
    q3_ms: q3,
    iqr_ms: q3 - q1,
    fraction_over_33ms: over33 / sorted.length,
    fraction_over_100ms: over100 / sorted.length,
  };
}

export const workerOffloadScenarios: BenchScenario[] = [makeOffloadScenario()];
