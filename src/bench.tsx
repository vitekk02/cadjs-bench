import React from "react";
import { createRoot } from "react-dom/client";
import { AppLoader } from "./AppLoader";
import { BenchRunner } from "./BenchRunner";
import { allScenarios } from "./scenarios";

const root = createRoot(document.getElementById("root")!);
root.render(
  <AppLoader>
    <BenchRunner scenarios={allScenarios} />
  </AppLoader>,
);
