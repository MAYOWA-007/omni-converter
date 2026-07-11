import { useEffect, useRef, useState } from "react";
import type { ConversionRecipe, ConversionSettings, EditorControl, PreflightResult } from "../lib/types";

interface ControlSurfaceProps {
  recipe: ConversionRecipe;
  preflight: PreflightResult | null;
  settings: ConversionSettings;
  getOptions: (recipe: ConversionRecipe, control: EditorControl) => string[];
  getLabel: (control: EditorControl) => string;
  onChange: (control: EditorControl, value: string) => void;
  onConvert: () => void;
  onRestart: () => void;
  unavailable: boolean;
}

export function ControlSurface({ recipe, preflight, settings, getOptions, getLabel, onChange, onConvert, onRestart, unavailable }: ControlSurfaceProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const [columns, setColumns] = useState(1);
  const controls = recipe.editorControls;

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const updateColumns = () => setColumns(columnCount(controls.length, surface.clientWidth));
    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [controls.length]);

  return (
    <section className="control-surface" ref={surfaceRef} data-control-count={controls.length} data-columns={columns} aria-label="Conversion controls">
      {controls.length ? (
        <div className="control-list" data-columns={columns}>
          {controls.map((control) => {
            const options = getOptions(recipe, control);
            const id = `control-${control}`;
            return (
              <label className="control-row" htmlFor={id} key={control}>
                <span>{getLabel(control)}</span>
                <select id={id} value={settings[control] ?? options[0] ?? "Auto"} onChange={(event) => onChange(control, event.target.value)}>
                  {options.map((option) => <option value={option} key={option}>{option}</option>)}
                </select>
              </label>
            );
          })}
        </div>
      ) : null}
      {preflight && preflight.status !== "blocked" ? <p className="device-note">Estimated on this device: {preflight.estimate}</p> : null}
      {preflight?.status === "blocked" ? <p className="device-note bad">{preflight.reasons[0] ?? "This option is not available for this file."}</p> : null}
      <div className="edit-actions">
        <button className="primary-action" disabled={unavailable} type="button" onClick={onConvert}>{unavailable ? "Unavailable" : "Convert"}</button>
        <button className="ghost-action" type="button" onClick={onRestart}>Start over</button>
      </div>
    </section>
  );
}

export function columnCount(controlCount: number, width: number) {
  if (controlCount <= 1 || width < 620) return 1;
  if (controlCount >= 6 && width >= 1080) return 3;
  return 2;
}
