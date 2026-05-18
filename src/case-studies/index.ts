import { buildFlange } from "./flange";
import { buildBracket } from "./bracket";
import { buildHub } from "./hub";
import { buildFlangeFacetedAB } from "./flangeFacetedAB";
import type { CaseStudy } from "./types";

export type { CaseStudy, CaseStudyStage } from "./types";

/** Map of case-study id → builder function. */
export const CASE_STUDIES: Record<string, () => Promise<CaseStudy>> = {
  flange: buildFlange,
  bracket: buildBracket,
  hub: buildHub,
  "flange-ab": buildFlangeFacetedAB,
};

export const CASE_STUDY_IDS = Object.keys(CASE_STUDIES);
