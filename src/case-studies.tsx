import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppLoader } from "./AppLoader";
import { CaseStudyView } from "./case-studies/CaseStudyView";
import { CASE_STUDIES, type CaseStudy } from "./case-studies/index";

declare global {
  interface Window {
    /**
     * Switch to the n-th stage (1-based) of the currently loaded case study
     * without rebuilding it. Returns true if the stage exists, false
     * otherwise. Used by the Playwright screenshot harness so each case is
     * built only once per page load.
     */
    __setStage?: (n: number) => boolean;
    /** Number of stages in the loaded case study, or 0 if none loaded. */
    __stageCount?: number;
    /** Per-stage metadata (id + label) for the loaded case study. */
    __stageMeta?: { id: string; label: string }[];
  }
}

interface ParsedQuery {
  caseId: string | null;
  stageIndex: number;
}

function parseQuery(): ParsedQuery {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("case");
  const stage = params.get("stage");
  const stageIndex = stage ? Math.max(0, parseInt(stage, 10) - 1) : 0;
  return { caseId, stageIndex };
}

function CaseStudyIndex(): React.ReactElement {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, margin: 0, marginBottom: 12 }}>
        cadjs case studies
      </h1>
      <p>
        Available case studies. Append{" "}
        <code>?case=&lt;id&gt;&amp;stage=&lt;n&gt;</code> to view a specific
        stage:
      </p>
      <ul>
        {Object.keys(CASE_STUDIES).map((id) => (
          <li key={id}>
            <a href={`?case=${id}&stage=1`}>{id}</a> — first stage
          </li>
        ))}
      </ul>
      <p>
        Stage indices are 1-based. Each builder is a pure async function in
        <code> packages/bench/src/case-studies/</code>.
      </p>
    </div>
  );
}

function CaseStudyRunner(): React.ReactElement {
  const { caseId, stageIndex: initialStageIndex } = parseQuery();
  const [study, setStudy] = useState<CaseStudy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(initialStageIndex);

  useEffect(() => {
    if (!caseId) return;
    const builder = CASE_STUDIES[caseId];
    if (!builder) {
      setError(
        `Unknown case study: ${caseId}. Known: ${Object.keys(CASE_STUDIES).join(", ")}`,
      );
      return;
    }
    let cancelled = false;
    setError(null);
    setStudy(null);
    builder()
      .then((cs) => {
        if (!cancelled) setStudy(cs);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // Expose a stage-switcher on `window` so Playwright can advance stages
  // without reloading the page (rebuilding takes seconds per case).
  useEffect(() => {
    if (!study) {
      delete window.__setStage;
      window.__stageCount = 0;
      delete window.__stageMeta;
      return;
    }
    window.__stageCount = study.stages.length;
    window.__stageMeta = study.stages.map((s) => ({
      id: s.id,
      label: s.label,
    }));
    window.__setStage = (n: number): boolean => {
      const idx = n - 1;
      if (idx < 0 || idx >= study.stages.length) return false;
      // If we're already on this stage, React skips re-render and the
      // mesh effect won't fire — set ready true synchronously so the test
      // doesn't time out waiting for an effect that never runs.
      setActiveStageIndex((prev) => {
        if (prev === idx) {
          window.__caseStudyReady = true;
        } else {
          window.__caseStudyReady = false;
        }
        return idx;
      });
      return true;
    };
    return () => {
      delete window.__setStage;
      window.__stageCount = 0;
      delete window.__stageMeta;
    };
  }, [study]);

  if (!caseId) return <CaseStudyIndex />;
  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui", color: "#c00" }}>
        Error: {error}
      </div>
    );
  }
  if (!study) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Building <code>{caseId}</code>…
      </div>
    );
  }
  const stage =
    study.stages[Math.min(activeStageIndex, study.stages.length - 1)];
  if (!stage) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        No stages in {study.name}.
      </div>
    );
  }
  return (
    <CaseStudyView
      stage={stage}
      caseName={study.name}
      caseDescription={study.description}
    />
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <AppLoader>
    <CaseStudyRunner />
  </AppLoader>,
);
