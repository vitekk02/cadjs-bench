/**
 * Isolated postMessage round-trip benchmark.
 *
 * The worker-offload scenario reports total wall-clock for a 4-way union
 * dispatched through the OCC worker. Subtracting the inline equivalent
 * (Section eval-boolean) yields a ~50 ms "worker overhead" figure, but that
 * subtraction conflates structured-clone cost, postMessage scheduling, and
 * any worker-side bookkeeping that the inline path skips.
 *
 * This scenario isolates the structured-clone + postMessage cost alone, by
 * spawning a tiny echo Worker and timing the round-trip of a string payload
 * sized to match the typical OCC BRep text payload.
 *
 * Three payload sizes are reported:
 *   - 10 KB   (typical single-extrude result)
 *   - 100 KB  (typical mid-complexity boolean union result)
 *   - 1 MB    (worst-case heavy union)
 *
 * Each scenario reports the round-trip wall-clock per message. The structured
 * clone happens twice (main->worker and worker->main), so per-direction cost
 * is approximately half the reported median.
 */

import type { BenchScenario } from "../timing";

const ECHO_WORKER_SOURCE = `
self.onmessage = (e) => {
  // Echo the message back. Structured-clone runs on both legs.
  self.postMessage(e.data);
};
`;

let echoWorker: Worker | null = null;

function getEchoWorker(): Worker {
  if (echoWorker) return echoWorker;
  const blob = new Blob([ECHO_WORKER_SOURCE], {
    type: "application/javascript",
  });
  const url = URL.createObjectURL(blob);
  echoWorker = new Worker(url);
  return echoWorker;
}

function makePayload(sizeBytes: number): string {
  // 1 char ≈ 2 bytes in UTF-16 in-memory; for postMessage / structured clone
  // we care about character count, which is sizeBytes/2 here.
  const charCount = Math.floor(sizeBytes / 2);
  const chunk = "abcdefghij";
  return chunk.repeat(Math.ceil(charCount / chunk.length)).slice(0, charCount);
}

function roundtrip(payload: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const w = getEchoWorker();
    const handler = () => {
      w.removeEventListener("message", handler);
      resolve();
    };
    w.addEventListener("message", handler);
    w.postMessage(payload);
  });
}

function makeRoundtripScenario(
  label: string,
  sizeBytes: number,
): BenchScenario {
  let payload: string;
  return {
    name: `postMessage round-trip / ${label}`,
    group: "postMessage round-trip",
    description: `Echo Worker round-trip of a ${label} string payload (structured-clone both legs).`,
    setup: async () => {
      payload = makePayload(sizeBytes);
      // Warm the worker
      await roundtrip(payload);
    },
    run: async () => {
      await roundtrip(payload);
    },
    n: 50,
    warmups: 3,
  };
}

export const postMessageRoundtripScenarios: BenchScenario[] = [
  makeRoundtripScenario("10 KB", 10 * 1024),
  makeRoundtripScenario("100 KB", 100 * 1024),
  makeRoundtripScenario("1 MB", 1024 * 1024),
];
