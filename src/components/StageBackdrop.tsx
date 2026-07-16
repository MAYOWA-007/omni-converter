import type { CSSProperties } from "react";
import type { OmniWorkflowStage } from "../hooks/useOmniWorkflow";
import { STAGE_BACKDROPS, themeForStage } from "../design/stageThemes";

interface StageBackdropProps {
  stage: OmniWorkflowStage;
}

export function StageBackdrop({ stage }: StageBackdropProps) {
  const activeTheme = themeForStage(stage);

  return (
    <div className="stage-backdrop" aria-hidden="true">
      {STAGE_BACKDROPS.map(({ theme, atlasPosition }) => (
        <div
          className={`stage-backdrop__panel ${theme === activeTheme ? "is-active" : ""}`}
          data-theme={theme}
          key={theme}
            style={{ "--atlas-position": atlasPosition } as CSSProperties & Record<"--atlas-position", string>}
        />
      ))}
    </div>
  );
}
