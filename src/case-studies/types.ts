import type { SceneElement } from "@vitekk02/cadjs";

/** One stage of a case-study walkthrough — the geometry visible at this step. */
export interface CaseStudyStage {
  /** Stable identifier for the stage; appears in the screenshot filename. */
  id: string;
  /** Short label shown in the renderer overlay. */
  label: string;
  /** Optional longer description for the thesis caption. */
  description?: string;
  /** The element to render at this stage. */
  element: SceneElement;
}

/** A case-study walkthrough — a sequence of stages building one part. */
export interface CaseStudy {
  id: string;
  name: string;
  description: string;
  stages: CaseStudyStage[];
}
