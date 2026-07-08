import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FileType2, Search, Sparkles } from "lucide-react";
import { DropVortex } from "./components/DropVortex";
import { RecipeCard } from "./components/RecipeCard";
import { filterRecipesByQuery, recipesForFamily } from "./data/conversionMatrix";
import { formatBytes, formatDuration, inspectFile } from "./lib/fileInspection";
import { convertImageRecipe, downloadOutput } from "./lib/imageConversions";
import { getDeviceProfile, preflightRecipe } from "./lib/preflight";
import type { ConversionRecipe, DeviceProfile, FileInspection, PreflightResult } from "./lib/types";

type Stage = "drop" | "analyzing" | "choose" | "edit";

export default function App() {
  const [stage, setStage] = useState<Stage>("drop");
  const [dragActive, setDragActive] = useState(false);
  const [inspection, setInspection] = useState<FileInspection | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [device, setDevice] = useState<DeviceProfile | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  useEffect(() => {
    void getDeviceProfile().then(setDevice);
  }, []);

  async function handleFile(file: File) {
    setStage("analyzing");
    setSourceFile(file);
    setSelectedRecipeId(null);
    const nextInspection = await inspectFile(file);
    setInspection(nextInspection);
    window.setTimeout(() => setStage("choose"), 920);
  }

  const recipes = useMemo(() => (inspection ? recipesForFamily(inspection.family) : []), [inspection]);
  const preflights = useMemo(() => {
    const map = new Map<string, PreflightResult>();
    if (!inspection || !device) return map;
    recipes.forEach((recipe) => map.set(recipe.id, preflightRecipe(recipe, inspection, device)));
    return map;
  }, [device, inspection, recipes]);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null;
  const selectedPreflight = selectedRecipe ? preflights.get(selectedRecipe.id) ?? null : null;

  function selectRecipe(recipe: ConversionRecipe) {
    setSelectedRecipeId(recipe.id);
    setStage("edit");
  }

  async function runConversion(recipe: ConversionRecipe) {
    if (!sourceFile || !inspection) {
      throw new Error("Choose a file first.");
    }

    const outputs = await convertImageRecipe(sourceFile, inspection, recipe);
    outputs.forEach(downloadOutput);
    return outputs.length;
  }

  return (
    <main className={`app-shell stage-${stage}`}>
      <Topbar />

      {stage === "drop" ? (
        <DropScreen active={dragActive} onFile={handleFile} onDragActive={setDragActive} />
      ) : null}

      {stage === "analyzing" && inspection ? <AnalyzeScreen inspection={inspection} /> : null}

      {stage === "choose" && inspection ? (
        <ChooseScreen inspection={inspection} recipes={recipes} preflights={preflights} onSelect={selectRecipe} onBack={() => setStage("drop")} />
      ) : null}

      {stage === "edit" && inspection && selectedRecipe ? (
        <EditScreen
          inspection={inspection}
          recipe={selectedRecipe}
          preflight={selectedPreflight}
          onConvert={runConversion}
          onBack={() => setStage("choose")}
          onRestart={() => {
            setInspection(null);
            setSourceFile(null);
            setSelectedRecipeId(null);
            setStage("drop");
          }}
        />
      ) : null}
    </main>
  );
}

function Topbar() {
  return (
    <nav className="topbar">
      <a className="brand" href={import.meta.env.BASE_URL}>
        <span className="brand-mark" aria-hidden="true">OC</span>
        <span>Omni</span>
        <b>Converter</b>
      </a>
    </nav>
  );
}

function DropScreen({ active, onFile, onDragActive }: { active: boolean; onFile: (file: File) => void; onDragActive: (active: boolean) => void }) {
  return (
    <section className="screen drop-screen">
      <DropVortex active={active} fileLoaded={false} onFile={onFile} onDragActive={onDragActive} />
    </section>
  );
}

function AnalyzeScreen({ inspection }: { inspection: FileInspection }) {
  return (
    <section className="screen analyze-screen">
      <div className="analysis-card">
        <Sparkles size={18} />
        <span>Reading file</span>
        <b>{inspection.name}</b>
        <i />
      </div>
    </section>
  );
}

function ChooseScreen({
  inspection,
  recipes,
  preflights,
  onSelect,
  onBack
}: {
  inspection: FileInspection;
  recipes: ConversionRecipe[];
  preflights: Map<string, PreflightResult>;
  onSelect: (recipe: ConversionRecipe) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const visibleRecipes = useMemo(() => filterRecipesByQuery(recipes, query), [query, recipes]);
  const countLabel = query.trim() ? `${visibleRecipes.length} of ${recipes.length} conversions` : `${recipes.length} available conversions`;

  return (
    <section className="screen choose-screen">
      <button className="back-button" type="button" onClick={onBack}>
        <ChevronLeft size={16} />
        New file
      </button>
      <FileHeader inspection={inspection} />
      <div className="stage-copy">
        <span>{countLabel}</span>
        <h1>What should it become?</h1>
      </div>
      <label className="conversion-search">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversions: jpg, web, icon, pdf, embed..." />
      </label>
      <div className="recipe-stage-grid">
        {visibleRecipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} preflight={preflights.get(recipe.id) ?? null} selected={false} onSelect={() => onSelect(recipe)} />
        ))}
        {!visibleRecipes.length ? <p className="empty-results">No matching conversion. Try a format name like PNG, PDF, JPG, WebP, icon, embed, or ZIP.</p> : null}
      </div>
    </section>
  );
}

function EditScreen({
  inspection,
  recipe,
  preflight,
  onConvert,
  onBack,
  onRestart
}: {
  inspection: FileInspection;
  recipe: ConversionRecipe;
  preflight: PreflightResult | null;
  onConvert: (recipe: ConversionRecipe) => Promise<number>;
  onBack: () => void;
  onRestart: () => void;
}) {
  const unavailable = preflight?.status === "blocked";
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const working = status === "working";

  async function handleConvert() {
    setStatus("working");
    setMessage("");

    try {
      const outputCount = await onConvert(recipe);
      setStatus("done");
      setMessage(outputCount === 1 ? "Download created." : `${outputCount} downloads created.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "This conversion could not finish.");
    }
  }

  return (
    <section className="screen edit-screen">
      <button className="back-button" type="button" onClick={onBack}>
        <ChevronLeft size={16} />
        Outputs
      </button>
      <FileHeader inspection={inspection} />
      <div className="edit-layout">
        <div className="stage-copy">
          <span>{recipe.output}</span>
          <h1>{recipe.title}</h1>
          <p>{recipe.description}</p>
        </div>
        <div className="control-surface">
          <div className="control-list">
            {recipe.editorControls.slice(0, 8).map((control) => (
              <label className="control-row" key={control}>
                <span>{controlLabel(control)}</span>
                <input placeholder={controlPlaceholder(control)} />
              </label>
            ))}
          </div>
          {preflight?.status === "slow" ? <p className="device-note">This conversion may take a while.</p> : null}
          {unavailable ? <p className="device-note bad">This option is not available for this file.</p> : null}
          {message ? <p className={`device-note ${status === "error" ? "bad" : ""}`}>{message}</p> : null}
          <div className="edit-actions">
            <button className="primary-action" disabled={unavailable || working} type="button" onClick={handleConvert}>
              {unavailable ? "Unavailable" : working ? "Converting..." : status === "done" ? "Convert again" : "Convert"}
            </button>
            <button className="ghost-action" type="button" onClick={onRestart}>
              Start over
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FileHeader({ inspection }: { inspection: FileInspection }) {
  const details = [
    inspection.extension ? inspection.extension.toUpperCase() : inspection.mime,
    formatBytes(inspection.size),
    inspection.width && inspection.height ? `${inspection.width} x ${inspection.height}` : null,
    formatDuration(inspection.duration)
  ].filter(Boolean);

  return (
    <div className="file-header">
      <FileType2 size={16} />
      <b>{inspection.name}</b>
      <span>{details.join(" / ")}</span>
    </div>
  );
}

function controlLabel(control: string) {
  return (
    {
      timeline: "Timeline",
      trim: "Trim",
      crop: "Crop",
      aspectRatio: "Aspect ratio",
      resolution: "Resolution",
      frameRate: "Frame rate",
      frameInterval: "Frame interval",
      chapterInterval: "Chapters",
      audioGain: "Volume",
      audioFade: "Fades",
      waveform: "Waveform",
      captions: "Captions",
      color: "Color",
      compression: "Compression",
      pageOrder: "Pages",
      pageSize: "Page size",
      margins: "Margins",
      metadata: "Details",
      watermark: "Watermark",
      batchNaming: "Names",
      bundle: "Bundle"
    }[control] ?? control
  );
}

function controlPlaceholder(control: string) {
  return (
    {
      timeline: "Full length",
      trim: "Start / end",
      crop: "None",
      aspectRatio: "Original",
      resolution: "Original",
      frameRate: "Auto",
      frameInterval: "Every 1 sec",
      chapterInterval: "Auto",
      audioGain: "100%",
      audioFade: "None",
      waveform: "Auto",
      captions: "None",
      color: "Original",
      compression: "Balanced",
      pageOrder: "All",
      pageSize: "Auto",
      margins: "Default",
      metadata: "Keep",
      watermark: "None",
      batchNaming: "Auto",
      bundle: "ZIP"
    }[control] ?? "Auto"
  );
}
