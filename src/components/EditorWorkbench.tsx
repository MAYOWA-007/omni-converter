import type { ConversionRecipe, PreflightResult } from "../lib/types";

interface EditorWorkbenchProps {
  recipe: ConversionRecipe | null;
  preflight: PreflightResult | null;
}

const CONTROL_LABELS: Record<string, string> = {
  timeline: "Timeline",
  trim: "Trim range",
  crop: "Crop",
  rotation: "Rotation",
  aspectRatio: "Aspect ratio",
  resolution: "Resolution",
  frameRate: "Frame rate",
  frameInterval: "Frame interval",
  chapterInterval: "Chapter interval",
  audioGain: "Audio gain",
  audioFade: "Audio fades",
  sampleRate: "Sample rate",
  audioChannels: "Channels",
  bitDepth: "Bit depth",
  waveform: "Waveform",
  typography: "Typography",
  captions: "Captions",
  color: "Color",
  compression: "Compression",
  pageOrder: "Page order",
  pageLayout: "Layout",
  pageSize: "Page size",
  margins: "Margins",
  metadata: "Metadata",
  watermark: "Watermark",
  batchNaming: "Batch naming",
  bundle: "Bundle"
};

export function EditorWorkbench({ recipe, preflight }: EditorWorkbenchProps) {
  if (!recipe) {
    return (
      <section className="editor-panel empty">
        <span className="panel-kicker">Edit</span>
        <h2>Choose an output</h2>
        <p>Choose an output first, then tune the settings.</p>
      </section>
    );
  }

  return (
    <section className="editor-panel">
      <div className="panel-kicker">Edit</div>
      <div className="editor-head">
        <div>
          <h2>{recipe.title}</h2>
          <p>{preflight?.estimate ?? "Preparing estimate"}</p>
        </div>
        <button className="convert-button" disabled={preflight?.status === "blocked"} type="button">
          {preflight?.status === "blocked" ? "Unavailable" : "Continue"}
        </button>
      </div>
      <div className="treatment-row">
        {recipe.treatments.map((treatment) => (
          <span key={treatment}>{treatment}</span>
        ))}
      </div>
      <div className="control-grid">
        {recipe.editorControls.map((control) => (
          <label className="control" key={control}>
            <span>{CONTROL_LABELS[control] ?? control}</span>
            {control === "timeline" ? <div className="timeline-track"><i style={{ width: "34%" }} /></div> : <input placeholder="Auto" />}
          </label>
        ))}
      </div>
      <div className={`preflight-box ${preflight?.status ?? "pending"}`}>
        <b>{preflight?.label ?? "Checking option"}</b>
        <ul>
          {(preflight?.reasons ?? ["Checking this option."]).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
