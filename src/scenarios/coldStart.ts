/**
 * Cold-start measurements for the WASM-backed services. The page-level
 * AppLoader has already paid this cost by the time the bench mounts, so each
 * scenario tears the relevant service down and re-initialises it.
 *
 * Note that this measures *re-init* on a warm browser process: the V8 JIT
 * cache, network cache, and possibly the WASM module cache are all hot. A
 * truly cold tab visit to the deployed app would be slower; that figure
 * belongs in the prose, not in this harness.
 */

import { OccWorkerClient, SketchSolverService } from "@vitekk02/cadjs";
import type { BenchScenario } from "../timing";

export const coldStartScenarios: BenchScenario[] = [
  {
    name: "cold start / OCC worker init",
    group: "cold start",
    description:
      "OccWorkerClient.dispose() then waitForReady() — measures Worker spawn + WASM module init.",
    run: async () => {
      OccWorkerClient.getInstance().dispose();
      await OccWorkerClient.getInstance().waitForReady();
    },
    n: 20,
    warmups: 1,
  },
  {
    name: "cold start / planegcs init",
    group: "cold start",
    description:
      "SketchSolverService.resetInit() then getGCS() — measures planegcs WASM module init.",
    run: async () => {
      SketchSolverService.getInstance().resetInit();
      await SketchSolverService.getInstance().getGCS();
    },
    n: 20,
    warmups: 1,
  },
];
