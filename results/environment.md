# Bench environment

Run date: 2026-05-18.

This is the canonical run backing the numbers in the thesis evaluation chapter.

## Hardware

| Field          | Value                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| Machine        | Lenovo Legion 5 16IRX9                                                    |
| CPU            | Intel Core i7-14650HX, 16 cores / 24 threads, base 2.2 GHz, boost 5.2 GHz |
| RAM            | 32 GiB                                                                    |
| Integrated GPU | Intel UHD Graphics (Raptor Lake-S) — inactive in Chrome                   |
| Discrete GPU   | NVIDIA GeForce RTX 4070 Laptop, driver 580.126.09 — **active**            |
| OS             | Ubuntu 24.04.3 LTS, kernel 6.17.0-23-generic                              |
| Browser        | Google Chrome 141.0.7390.54                                               |
| Node.js        | 22.16.0                                                                   |
| npm            | 10.9.2                                                                   |
| cadjs version  | @vitekk02/cadjs@0.1.1                                                     |

## Chrome graphics stack (from `chrome://gpu`)

| Feature       | Status                 |
| ------------- | ---------------------- |
| WebGL         | Hardware accelerated   |
| WebGL2        | Hardware accelerated   |
| Canvas        | Hardware accelerated   |
| Rasterization | Hardware accelerated   |
| WebGPU        | Disabled               |
| Vulkan        | Disabled               |
| Skia backend  | GaneshGL               |
| ANGLE         | OpenGL ES translation  |
| Optimus       | true (active = NVIDIA) |

Full `chrome://gpu` dump in `chrome-gpu.txt`.

## Run protocol

- CPU governor: `performance` (intel_pstate, set via `cpupower frequency-set -g performance`; default for this machine is `powersave`)
- GNOME power profile: Performance (`powerprofilesctl set performance`; default is `balanced`)
- Tabs open in Chrome: bench.html only
- Sample count per scenario: 15–50 (overridden per scenario; see CSV `n` column)
- Warm-ups discarded: 1–3 (see CSV `warmups` column)
- Statistics reported: median, p95, stddev, IQR (q3 − q1), min, max
- Raw per-run measurements preserved in the CSV `runs_ms` column

## Worker-offload frame-interval distribution

Captured from the report panel below the main table after the 4-way boolean
union scenario. The CSV's `runs_ms` column for that row holds wall-clock per
op, **not** the frame-interval distribution; this is the headline number for
§4.2.1 (main-thread responsiveness).

| Stat                                | ms / count |
| ----------------------------------- | ---------- |
| frame-interval samples              | 401        |
| frame median                        | 16.67      |
| frame p95                           | 16.67      |
| frame min                           | 16.66      |
| frame max                           | 16.68      |
| frame stddev                        | 0.00       |
| frame IQR (q3 − q1)                 | 0.01       |
| fraction > 33 ms (dropped < 30 fps) | 0.0%       |
| fraction > 100 ms (visible stutter) | 0.0%       |
| long-task entries (> 50 ms blocks)  | 0          |
| total ms blocked by long tasks      | 0.00       |
| longest single long-task            | 0.00       |

401 rAF samples across 20 boolean unions, all locked at the 60 Hz cadence.

## Quick read on the CSV

| Scenario family              | Span                 | Notes                                       |
| ---------------------------- | -------------------- | ------------------------------------------- |
| Cold-start OCC worker        | 1697 ms median       | Worker spawn + WASM module init             |
| Cold-start planegcs          | 6.5 ms median        | Much smaller WASM module                    |
| Boolean union N=2..6         | 90 → 282 → 544 ms    | Roughly 2× per added operand                |
| Boolean diff / intersect N=2 | 52–58 ms             | Faster than union N=2                       |
| Fillet 1 / 4 / 12 edges      | 32 / 61 / 432 ms     | Sharp jump filleting all 12 edges of a cube |
| Extrude 4 / 16 / 64-seg      | 15 / 52 / 209 ms     | ~linear in profile complexity               |
| Sweep straight / helix       | 65 / 486 ms          | Helix path is much more work                |
| Sketch solver 8/32/64-gon    | 0.035–1.07 ms        | All well under 2 ms                         |
| postMessage 10 KB / 100 KB / 1 MB | 0.020 / 0.060 / 0.455 ms | Round-trip cost scales roughly linearly |
| Worker offload 4-way union   | 333 ms median        | +48 ms over inline at N=4 (postMessage tax) |
