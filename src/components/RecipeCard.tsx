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
        {recipe.treatments.slice(0, 4).map((treatment) => (
          <span key={treatment}>{treatment}</span>
        ))}
      </span>
      <span className="select-hint">Choose</span>
    </button>
  );
}
