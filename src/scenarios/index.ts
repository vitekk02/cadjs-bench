/**
 * Public barrel for benchmark scenarios. Order here is the order the scenarios
 * appear in the bench UI and in the resulting CSV.
 */

import type { BenchScenario } from "../timing";
import { coldStartScenarios } from "./coldStart";
import { booleanScenarios } from "./booleanOps";
import { filletScenarios } from "./fillet";
import { extrudeScenarios } from "./extrude";
import { sweepScenarios } from "./sweep";
import { sketchSolverScenarios } from "./sketchSolver";
import { workerOffloadScenarios } from "./workerOffload";
import { postMessageRoundtripScenarios } from "./postMessageRoundtrip";

export const allScenarios: BenchScenario[] = [
  ...coldStartScenarios,
  ...booleanScenarios,
  ...filletScenarios,
  ...extrudeScenarios,
  ...sweepScenarios,
  ...sketchSolverScenarios,
  ...workerOffloadScenarios,
  ...postMessageRoundtripScenarios,
];

export {
  coldStartScenarios,
  booleanScenarios,
  filletScenarios,
  extrudeScenarios,
  sweepScenarios,
  sketchSolverScenarios,
  workerOffloadScenarios,
  postMessageRoundtripScenarios,
};
