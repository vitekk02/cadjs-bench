import React, { useCallback, useMemo, useState } from "react";
import {
  BenchResult,
  BenchScenario,
  resultsToCSV,
  runScenario,
} from "./timing";
import {
  computeFrameIntervalStats,
  getMergedLongTasks,
} from "./scenarios/workerOffload";

interface BenchRunnerProps {
  scenarios: BenchScenario[];
}

type RunState =
  | { kind: "idle" }
  | { kind: "running"; current: string }
  | { kind: "done" };

const formatMs = (v: number): string =>
  Number.isFinite(v) ? v.toFixed(2) : "—";

export const BenchRunner: React.FC<BenchRunnerProps> = ({ scenarios }) => {
  const [results, setResults] = useState<Map<string, BenchResult>>(new Map());
  const [runState, setRunState] = useState<RunState>({ kind: "idle" });

  const runOne = useCallback(async (scenario: BenchScenario) => {
    setRunState({ kind: "running", current: scenario.name });
    try {
      const result = await runScenario(scenario);
      setResults((prev) => {
        const next = new Map(prev);
        next.set(scenario.name, result);
        return next;
      });
    } finally {
      setRunState({ kind: "idle" });
    }
  }, []);

  const runAll = useCallback(async () => {
    for (const scenario of scenarios) {
      setRunState({ kind: "running", current: scenario.name });
      const result = await runScenario(scenario);
      setResults((prev) => {
        const next = new Map(prev);
        next.set(scenario.name, result);
        return next;
      });
    }
    setRunState({ kind: "done" });
  }, [scenarios]);

  const downloadCSV = useCallback(() => {
    const rows = scenarios
      .map((s) => results.get(s.name))
      .filter((r): r is BenchResult => r !== undefined);
    const csv = resultsToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `cadjs-bench-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [results, scenarios]);

  const groups = useMemo(() => {
    const map = new Map<string, BenchScenario[]>();
    for (const s of scenarios) {
      const key = s.group ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()];
  }, [scenarios]);

  const isBusy = runState.kind === "running";
  const hasResults = results.size > 0;
  const offloadResult = results.get("worker offload / 4-way union");
  const frameStats = offloadResult ? computeFrameIntervalStats() : null;
  const longTaskStats = offloadResult ? getMergedLongTasks() : null;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>cadjs bench</h1>
        <div style={styles.controls}>
          <button onClick={runAll} disabled={isBusy} style={styles.primaryBtn}>
            Run all
          </button>
          <button
            onClick={downloadCSV}
            disabled={!hasResults || isBusy}
            style={styles.secondaryBtn}
          >
            Download CSV
          </button>
          <span style={styles.status}>
            {runState.kind === "running" && `Running: ${runState.current}…`}
            {runState.kind === "done" && "All scenarios complete."}
            {runState.kind === "idle" && !isBusy && hasResults && "Idle."}
          </span>
        </div>
      </header>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Scenario</th>
            <th style={styles.thNum}>n</th>
            <th style={styles.thNum}>median ms</th>
            <th style={styles.thNum}>p95 ms</th>
            <th style={styles.thNum}>stddev ms</th>
            <th style={styles.thNum}>IQR ms</th>
            <th style={styles.thNum}>min</th>
            <th style={styles.thNum}>max</th>
            <th style={styles.th} />
          </tr>
        </thead>
        <tbody>
          {groups.map(([groupName, group]) => (
            <React.Fragment key={groupName || "_default"}>
              {groupName && (
                <tr>
                  <td colSpan={9} style={styles.groupRow}>
                    {groupName}
                  </td>
                </tr>
              )}
              {group.map((s) => {
                const r = results.get(s.name);
                const isRunning =
                  runState.kind === "running" && runState.current === s.name;
                return (
                  <tr
                    key={s.name}
                    style={isRunning ? styles.rowActive : undefined}
                  >
                    <td style={styles.td}>
                      <div>{s.name}</div>
                      {s.description && (
                        <div style={styles.desc}>{s.description}</div>
                      )}
                    </td>
                    <td style={styles.tdNum}>{r ? r.n : "—"}</td>
                    <td style={styles.tdNum}>
                      {r ? formatMs(r.median_ms) : "—"}
                    </td>
                    <td style={styles.tdNum}>{r ? formatMs(r.p95_ms) : "—"}</td>
                    <td style={styles.tdNum}>
                      {r ? formatMs(r.stddev_ms) : "—"}
                    </td>
                    <td style={styles.tdNum}>{r ? formatMs(r.iqr_ms) : "—"}</td>
                    <td style={styles.tdNum}>{r ? formatMs(r.min_ms) : "—"}</td>
                    <td style={styles.tdNum}>{r ? formatMs(r.max_ms) : "—"}</td>
                    <td style={styles.td}>
                      <button
                        onClick={() => runOne(s)}
                        disabled={isBusy}
                        style={styles.smallBtn}
                      >
                        Run
                      </button>
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {frameStats && (
        <div style={styles.offloadReport}>
          <h2 style={styles.subtitle}>Worker-offload frame intervals</h2>
          <p style={styles.offloadHint}>
            rAF intervals (ms) recorded during the 4-way union. Lower values =
            main thread free. Distribution across {frameStats.count} samples.
          </p>
          <table style={styles.smallTable}>
            <tbody>
              <tr>
                <td style={styles.kvKey}>median</td>
                <td style={styles.kvVal}>{formatMs(frameStats.median_ms)}</td>
              </tr>
              <tr>
                <td style={styles.kvKey}>p95</td>
                <td style={styles.kvVal}>{formatMs(frameStats.p95_ms)}</td>
              </tr>
              <tr>
                <td style={styles.kvKey}>min</td>
                <td style={styles.kvVal}>{formatMs(frameStats.min_ms)}</td>
              </tr>
              <tr>
                <td style={styles.kvKey}>max</td>
                <td style={styles.kvVal}>{formatMs(frameStats.max_ms)}</td>
              </tr>
              <tr>
                <td style={styles.kvKey}>stddev</td>
                <td style={styles.kvVal}>{formatMs(frameStats.stddev_ms)}</td>
              </tr>
              <tr>
                <td style={styles.kvKey}>IQR (q3 − q1)</td>
                <td style={styles.kvVal}>{formatMs(frameStats.iqr_ms)}</td>
              </tr>
              <tr>
                <td style={styles.kvKey}>over 33ms (dropped &lt; 30 fps)</td>
                <td style={styles.kvVal}>
                  {(frameStats.fraction_over_33ms * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td style={styles.kvKey}>over 100ms (visible stutter)</td>
                <td style={styles.kvVal}>
                  {(frameStats.fraction_over_100ms * 100).toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
          {longTaskStats && (
            <>
              <h2 style={{ ...styles.subtitle, marginTop: 16 }}>
                Main-thread long tasks
              </h2>
              <p style={styles.offloadHint}>
                PerformanceObserver "longtask" entries (&gt; 50 ms blocks on the
                main thread) during the offload runs. Zero is the strong signal
                that the worker kept the main thread free.
              </p>
              <table style={styles.smallTable}>
                <tbody>
                  <tr>
                    <td style={styles.kvKey}>count</td>
                    <td style={styles.kvVal}>{longTaskStats.count}</td>
                  </tr>
                  <tr>
                    <td style={styles.kvKey}>total ms blocked</td>
                    <td style={styles.kvVal}>
                      {formatMs(longTaskStats.total_ms)}
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.kvKey}>longest single task</td>
                    <td style={styles.kvVal}>
                      {formatMs(longTaskStats.max_ms)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: 24,
    color: "#222",
    maxWidth: 1100,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    margin: 0,
    marginBottom: 8,
  },
  controls: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  primaryBtn: {
    padding: "6px 14px",
    cursor: "pointer",
    border: "1px solid #2e75b6",
    background: "#2e75b6",
    color: "white",
    borderRadius: 4,
  },
  secondaryBtn: {
    padding: "6px 14px",
    cursor: "pointer",
    border: "1px solid #888",
    background: "white",
    color: "#222",
    borderRadius: 4,
  },
  smallBtn: {
    padding: "2px 10px",
    cursor: "pointer",
    border: "1px solid #888",
    background: "white",
    borderRadius: 3,
    fontSize: 12,
  },
  status: {
    color: "#666",
    fontSize: 13,
    marginLeft: 8,
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "6px 10px",
    borderBottom: "2px solid #ccc",
    fontWeight: 600,
  },
  thNum: {
    textAlign: "right",
    padding: "6px 10px",
    borderBottom: "2px solid #ccc",
    fontWeight: 600,
    width: 90,
  },
  td: {
    padding: "6px 10px",
    borderBottom: "1px solid #eee",
    verticalAlign: "top",
  },
  tdNum: {
    padding: "6px 10px",
    borderBottom: "1px solid #eee",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  desc: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  groupRow: {
    padding: "10px 10px 4px",
    fontWeight: 600,
    color: "#555",
    background: "#fafafa",
    borderBottom: "1px solid #eee",
  },
  rowActive: {
    background: "#fff7e0",
  },
  offloadReport: {
    marginTop: 24,
    padding: "12px 16px",
    background: "#f7faff",
    border: "1px solid #d3e0f0",
    borderRadius: 4,
    maxWidth: 480,
  },
  subtitle: {
    fontSize: 16,
    margin: 0,
    marginBottom: 4,
  },
  offloadHint: {
    fontSize: 12,
    color: "#666",
    margin: 0,
    marginBottom: 8,
  },
  smallTable: {
    borderCollapse: "collapse",
    fontSize: 13,
  },
  kvKey: {
    padding: "3px 12px 3px 0",
    color: "#555",
  },
  kvVal: {
    padding: "3px 0",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
  },
};
