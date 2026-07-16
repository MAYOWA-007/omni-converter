import type { OmniWorkflowStage } from "../hooks/useOmniWorkflow";

export type StageTheme = "oxblood" | "cream" | "soot" | "emerald";

export interface StageBackdropDefinition {
  theme: StageTheme;
  atlasPosition: string;
}

export const STAGE_BACKDROPS: StageBackdropDefinition[] = [
  { theme: "oxblood", atlasPosition: "center 0%" },
  { theme: "cream", atlasPosition: "center 33.333%" },
  { theme: "soot", atlasPosition: "center 66.667%" },
  { theme: "emerald", atlasPosition: "center 100%" },
];

const STAGE_THEME: Record<OmniWorkflowStage, StageTheme> = {
  drop: "oxblood",
  analyzing: "cream",
  choose: "soot",
  edit: "emerald",
  processing: "soot",
  results: "emerald",
};

export function themeForStage(stage: OmniWorkflowStage): StageTheme {
  return STAGE_THEME[stage];
}
