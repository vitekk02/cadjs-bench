/**
 * Timed-run harness for benchmark scenarios. Each scenario is run a fixed
 * number of times, leading warmups are discarded, and median/p95/min/max are
 * reported alongside the raw samples.
 *
 * Use `performance.now()` (sub-millisecond, monotonic) for all measurements.
 */

export interface BenchScenario {
  /** Stable identifier used as table key, CSV row name, and dedup key. */
  name: string;
  /** Optional grouping for the results table (e.g. "boolean", "fillet"). */
  group?: string;
  /** Free-text description shown next to the scenario name. */
  description?: string;
  /** Optional one-time setup, run before warmups. Returned value is passed to `run`. */
  setup?: () => Promise<unknown>;
  /** The work to time. Receives the value returned by `setup`, if any. */
  run: (ctx: unknown) => Promise<void>;
  /** Override the default sample count for this scenario. */
  n?: number;
  /** Override the default warmup count for this scenario. */
  warmups?: number;
}

export interface BenchResult {
  scenario: string;
  group: string;
  n: number;
  warmups: number;
  median_ms: number;
  p95_ms: number;
  min_ms: number;
  max_ms: number;
  /** Sample standard deviation (Bessel-corrected, divisor n-1). */
  stddev_ms: number;
  /** First quartile (25th percentile). */
  q1_ms: number;
  /** Third quartile (75th percentile). */
  q3_ms: number;
  /** Interquartile range = q3 - q1. */
  iqr_ms: number;
  runs_ms: number[];
}

export interface RunScenarioOptions {
  n?: number;
  warmups?: number;
}

const DEFAULT_N = 30;
const DEFAULT_WARMUPS = 2;

/**
 * Sort a copy of the input ascending. Used for percentile computation.
 */
function sortedAsc(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Linear-interpolated percentile on a pre-sorted ascending array.
 * `p` is in [0, 1].
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0]!;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

export async function runScenario(
  scenario: BenchScenario,
  options: RunScenarioOptions = {},
): Promise<BenchResult> {
  const n = scenario.n ?? options.n ?? DEFAULT_N;
  const warmups = scenario.warmups ?? options.warmups ?? DEFAULT_WARMUPS;

  const ctx = scenario.setup ? await scenario.setup() : undefined;

  for (let i = 0; i < warmups; i++) {
    await scenario.run(ctx);
  }

  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    await scenario.run(ctx);
    const t1 = performance.now();
    samples.push(t1 - t0);
  }

  const sorted = sortedAsc(samples);
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  const variance =
    samples.length > 1
      ? samples.reduce((s, v) => s + (v - mean) ** 2, 0) / (samples.length - 1)
      : 0;
  const stddev = Math.sqrt(variance);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  return {
    scenario: scenario.name,
    group: scenario.group ?? "",
    n,
    warmups,
    median_ms: percentile(sorted, 0.5),
    p95_ms: percentile(sorted, 0.95),
    min_ms: sorted[0]!,
    max_ms: sorted[sorted.length - 1]!,
    stddev_ms: stddev,
    q1_ms: q1,
    q3_ms: q3,
    iqr_ms: q3 - q1,
    runs_ms: samples,
  };
}

/**
 * Format a list of {@link BenchResult} into a CSV blob suitable for download.
 * Columns: scenario, group, n, median_ms, p95_ms, min_ms, max_ms.
 * Raw run samples are emitted as a final `runs_ms` column with `;`-separated
 * values so the CSV stays one row per scenario.
 */
export function resultsToCSV(results: BenchResult[]): string {
  const header = [
    "scenario",
    "group",
    "n",
    "warmups",
    "median_ms",
    "p95_ms",
    "min_ms",
    "max_ms",
    "stddev_ms",
    "q1_ms",
    "q3_ms",
    "iqr_ms",
    "runs_ms",
  ].join(",");
  const rows = results.map((r) =>
    [
      JSON.stringify(r.scenario),
      JSON.stringify(r.group),
      r.n,
      r.warmups,
      r.median_ms.toFixed(3),
      r.p95_ms.toFixed(3),
      r.min_ms.toFixed(3),
      r.max_ms.toFixed(3),
      r.stddev_ms.toFixed(3),
      r.q1_ms.toFixed(3),
      r.q3_ms.toFixed(3),
      r.iqr_ms.toFixed(3),
      JSON.stringify(r.runs_ms.map((v) => v.toFixed(3)).join(";")),
    ].join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}
