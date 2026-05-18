import React, { useCallback, useEffect, useState } from "react";
import { OccWorkerClient, SketchSolverService } from "@vitekk02/cadjs";

type LoadState = "loading" | "ready" | "error";

interface AppLoaderProps {
  children: React.ReactNode;
}

export const AppLoader: React.FC<AppLoaderProps> = ({ children }) => {
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      await Promise.all([
        OccWorkerClient.getInstance().waitForReady(),
        SketchSolverService.getInstance().getGCS(),
      ]);
      setState("ready");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (state === "loading") {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Initialising OpenCascade and planegcs…
      </div>
    );
  }
  if (state === "error") {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui", color: "#c00" }}>
        <p>Initialisation failed: {error}</p>
      </div>
    );
  }
  return <>{children}</>;
};
