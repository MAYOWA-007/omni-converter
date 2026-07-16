import { Gauge, OctagonAlert } from "lucide-react";
import type { ConversionRecipe, PreflightResult } from "../lib/types";

interface RecipeCardProps {
  recipe: ConversionRecipe;
  preflight: PreflightResult | null;
  selected: boolean;
  onSelect: () => void;
}

export function RecipeCard({ recipe, preflight, selected, onSelect }: RecipeCardProps) {
  const showStatus = preflight?.status === "blocked" || preflight?.status === "slow";
  const Icon = preflight?.status === "blocked" ? OctagonAlert : Gauge;
  const visibleTreatments = recipe.treatments.slice(0, 2);
  const hiddenTreatmentCount = recipe.treatments.length - visibleTreatments.length;

  return (
    <button className={`recipe-card ${selected ? "is-selected" : ""}`} onClick={onSelect} type="button">
      <span className="recipe-topline">
        <span>{recipe.output}</span>
        {showStatus ? (
          <span className={`status-chip ${preflight.status}`}>
            <Icon size={14} />
            {preflight.label}
          </span>
        ) : null}
      </span>
      <strong>{recipe.title}</strong>
      <p>{recipe.description}</p>
      <span className="treatment-list">
        {visibleTreatments.map((treatment) => (
          <span key={treatment}>{treatment}</span>
        ))}
        {hiddenTreatmentCount > 0 ? <span aria-label={`${hiddenTreatmentCount} more options`}>+{hiddenTreatmentCount}</span> : null}
      </span>
      <span className="select-hint">Choose</span>
    </button>
  );
}
