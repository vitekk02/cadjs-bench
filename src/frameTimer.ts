/**
 * Records `requestAnimationFrame` intervals and PerformanceObserver longtask
 * entries for the duration of a Promise. Used by the worker-offload scenario
 * to detect main-thread stalls during heavy OCC operations.
 *
 * Two signals are captured:
 *
 *  - rAF intervals: time between consecutive rAF callbacks. Capped at the
 *    display refresh ceiling when the main thread is free (e.g. 16.67 ms at
 *    60 Hz). Useful for confirming the main thread held vsync; less useful
 *    for measuring how badly it was blocked, because vsync clamps the upper
 *    end.
 *
 *  - Long-task entries: PerformanceEntry of type "longtask" the browser
 *    emits whenever the main thread is blocked for >50 ms by a single task.
 *    Useful as a direct measure of main-thread responsiveness independent
 *    of vsync clamping. Zero long tasks during worker-offloaded kernel
 *    work is the strong signal.
 *
 * Notes
 * -----
 * - The first rAF interval is discarded: it is the time between the
 *   synchronous `requestAnimationFrame(...)` call and the first scheduled
 *   callback, which the browser does not guarantee to be small.
 * - rAF only ticks when the tab is foregrounded. Run the bench with the tab
 *   visible.
 * - To see frame-interval distribution unclamped by vsync, launch Chrome
 *   with `--disable-frame-rate-limit --disable-gpu-vsync`.
 */

export interface LongTaskStats {
  count: number;
  total_ms: number;
  max_ms: number;
}

export interface FrameTimingResult<T> {
  result: T;
  frameIntervals_ms: number[];
  median_ms: number;
  p95_ms: number;
  min_ms: number;
  max_ms: number;
  longTasks: LongTaskStats;
}

export async function measureFrameTimingDuring<T>(
  work: () => Promise<T>,
): Promise<FrameTimingResult<T>> {
  const timestamps: number[] = [];
  let stopped = false;

  const tick = (t: number) => {
    timestamps.push(t);
    if (!stopped) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Long-task observer. Supported in Chrome/Edge; gracefully no-ops elsewhere.
  const longTaskDurations: number[] = [];
  let longTaskObserver: PerformanceObserver | null = null;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskDurations.push(entry.duration);
      }
    });
    longTaskObserver.observe({ type: "longtask", buffered: false });
  } catch {
    // longtask not supported in this browser; report zeros.
  }

  let result: T;
  try {
    result = await work();
  } finally {
    stopped = true;
    if (longTaskObserver) longTaskObserver.disconnect();
  }

  // Discard the first timestamp — it is the wall-clock when the first rAF
  // callback fires, not an interval. Pair-difference the rest.
  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i]! - timestamps[i - 1]!);
  }

  const sorted = [...intervals].sort((a, b) => a - b);
  const idx = (p: number) =>
    sorted.length === 0
      ? NaN
      : sorted[
          Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))
        ]!;

  return {
    result,
    frameIntervals_ms: intervals,
    median_ms: idx(0.5),
    p95_ms: idx(0.95),
    min_ms: sorted[0] ?? NaN,
    max_ms: sorted[sorted.length - 1] ?? NaN,
    longTasks: {
      count: longTaskDurations.length,
      total_ms: longTaskDurations.reduce((s, v) => s + v, 0),
      max_ms: longTaskDurations.length > 0 ? Math.max(...longTaskDurations) : 0,
    },
  };
}
