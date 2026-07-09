import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FileType2, Search, Sparkles } from "lucide-react";
import { DropVortex } from "./components/DropVortex";
import { RecipeCard } from "./components/RecipeCard";
import { formatBytes, formatDuration, inspectFile } from "./lib/fileInspection";
import { getDeviceProfile, preflightRecipe } from "./lib/preflight";
import type { ConversionRecipe, ConversionSettings, DeviceProfile, EditorControl, FileInspection, PreflightResult } from "./lib/types";

type Stage = "drop" | "analyzing" | "choose" | "edit";
type ConversionCatalog = typeof import("./data/conversionMatrix");

let catalogPromise: Promise<ConversionCatalog> | null = null;

function loadConversionCatalog() {
  catalogPromise ??= import("./data/conversionMatrix");
  return catalogPromise;
}

const DEFAULT_CONTROL_OPTIONS: Record<EditorControl, string[]> = {
  outputFormat: ["Auto", "PNG", "JPEG", "WebP", "AVIF", "PDF", "TXT", "Markdown", "HTML", "ZIP"],
  timeline: ["Full file", "Marked range", "Current clip", "Intro only", "Outro only", "Custom marks"],
  trim: ["None", "Start/end handles", "First 5 seconds", "First 15 seconds", "First 30 seconds", "Custom range"],
  crop: ["None", "Fit entire source", "Fill target", "Center crop", "Trim transparent edges", "Safe social crop", "Custom crop"],
  aspectRatio: ["Original", "1:1 square", "4:5 portrait", "16:9 widescreen", "9:16 vertical", "A4 page", "Letter page", "Custom"],
  resolution: ["Original", "512 px", "1024 px", "1080 px", "1920 px", "2K", "4K", "150 DPI", "300 DPI", "Custom"],
  frameRate: ["Source", "12 fps", "24 fps", "30 fps", "60 fps", "Custom"],
  frameInterval: ["Every frame", "Every 1 second", "Every 2 seconds", "Every 5 seconds", "Every 10 seconds", "Scene changes", "Custom interval"],
  chapterInterval: ["None", "Every minute", "Every 2 minutes", "Every 5 minutes", "Detected chapters", "Custom chapter marks"],
  audioGain: ["Keep source", "Normalize", "-6 dB", "-3 dB", "+3 dB", "+6 dB", "Mute", "Custom"],
  audioFade: ["None", "Fade in", "Fade out", "Fade in and out", "Crossfade clips", "Custom"],
  waveform: ["None", "PNG waveform", "SVG waveform", "Audiogram background", "Timeline peaks JSON"],
  captions: ["None", "Import SRT", "Import VTT", "Export SRT", "Export VTT", "Burn in later", "Transcript package"],
  color: ["Original", "sRGB", "Display P3", "Grayscale", "Transparent matte", "White matte", "Black matte"],
  compression: ["Lossless", "Maximum quality", "High quality", "Balanced", "Small file", "Tiny preview", "Custom"],
  pageOrder: ["All pages", "Current page", "First page", "Last page", "Odd pages", "Even pages", "Custom range", "Split every page"],
  pageSize: ["Auto", "Original", "Letter", "Legal", "A4", "A5", "16:9 slide", "4:5 carousel", "1:1 square", "Custom"],
  margins: ["None", "Narrow", "Standard", "Wide", "Bleed", "Safe area", "Custom"],
  metadata: ["Keep", "Strip", "Inspect report", "Normalize", "Rename title", "Redact hidden fields"],
  watermark: ["None", "Text watermark", "Image watermark", "Page number", "Date stamp", "Custom"],
  batchNaming: ["Keep source name", "Clean filename", "Numbered sequence", "Page number suffix", "Size suffix", "Date suffix", "Custom pattern"],
  bundle: ["Single file", "ZIP", "ZIP with manifest", "ZIP with README", "Folder by page", "Folder by format", "Checksum manifest"]
};

export default function App() {
  const [stage, setStage] = useState<Stage>("drop");
  const [dragActive, setDragActive] = useState(false);
  const [inspection, setInspection] = useState<FileInspection | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [device, setDevice] = useState<DeviceProfile | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ConversionCatalog | null>(null);

  async function handleFile(file: File) {
    setStage("analyzing");
    setSourceFile(file);
    setSelectedRecipeId(null);
    const [nextInspection, nextCatalog, nextDevice] = await Promise.all([inspectFile(file), loadConversionCatalog(), getDeviceProfile()]);
    setCatalog(nextCatalog);
    setInspection(nextInspection);
    setDevice(nextDevice);
    window.setTimeout(() => setStage("choose"), 920);
  }

  const recipes = useMemo(() => (inspection && catalog ? catalog.recipesForFamily(inspection.family) : []), [catalog, inspection]);
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

  async function runConversion(recipe: ConversionRecipe, settings: ConversionSettings) {
    if (!sourceFile || !inspection) {
      throw new Error("Choose a file first.");
    }

    const { convertRecipe, downloadOutput } = await import("./lib/conversions");
    const outputs = await convertRecipe(sourceFile, inspection, recipe, settings);
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

      {stage === "choose" && inspection && catalog ? (
        <ChooseScreen catalog={catalog} inspection={inspection} recipes={recipes} preflights={preflights} onSelect={selectRecipe} onBack={() => setStage("drop")} />
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
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="Omni Converter">
        <img src={`${import.meta.env.BASE_URL}favicon-48x48.png`} alt="" />
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
  catalog,
  inspection,
  recipes,
  preflights,
  onSelect,
  onBack
}: {
  catalog: ConversionCatalog;
  inspection: FileInspection;
  recipes: ConversionRecipe[];
  preflights: Map<string, PreflightResult>;
  onSelect: (recipe: ConversionRecipe) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [output, setOutput] = useState("all");
  const categories = useMemo(() => catalog.recipeCategories(recipes), [catalog, recipes]);
  const outputs = useMemo(() => catalog.recipeOutputs(recipes), [catalog, recipes]);
  const visibleRecipes = useMemo(() => {
    return catalog.filterRecipesByQuery(recipes, query).filter((recipe) => {
      const categoryMatch = category === "all" || recipe.category === category;
      const outputMatch = output === "all" || recipe.output === output;
      return categoryMatch && outputMatch;
    });
  }, [catalog, category, output, query, recipes]);
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
      <div className="conversion-filters" aria-label="Conversion filters">
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Output</span>
          <select value={output} onChange={(event) => setOutput(event.target.value)}>
            <option value="all">All outputs</option>
            {outputs.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
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
  onConvert: (recipe: ConversionRecipe, settings: ConversionSettings) => Promise<number>;
  onBack: () => void;
  onRestart: () => void;
}) {
  const runnable = recipe.implementation === "ready";
  const unavailable = preflight?.status === "blocked" || !runnable;
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<ConversionSettings>(() => initialSettingsForRecipe(recipe));
  const working = status === "working";

  useEffect(() => {
    setSettings(initialSettingsForRecipe(recipe));
    setStatus("idle");
    setMessage("");
  }, [recipe]);

  async function handleConvert() {
    setStatus("working");
    setMessage("");

    try {
      const outputCount = await onConvert(recipe, settings);
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
          <span>
            {recipe.category} / {recipe.output}
          </span>
          <h1>{recipe.title}</h1>
          <p>{recipe.description}</p>
        </div>
        <div className="control-surface">
          <div className="control-list">
            {recipe.editorControls.map((control) => (
              <label className="control-row" key={control}>
                <span>{controlLabel(control)}</span>
                <select value={settings[control] ?? getControlOptions(recipe, control)[0] ?? "Auto"} onChange={(event) => setSettings((current) => ({ ...current, [control]: event.target.value }))}>
                  {getControlOptions(recipe, control).map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {preflight?.status === "slow" ? <p className="device-note">This conversion may take a while.</p> : null}
          {preflight?.status === "blocked" ? <p className="device-note bad">{preflight.reasons[0] ?? "This option is not available for this file."}</p> : null}
          {!runnable && preflight?.status !== "blocked" ? <p className="device-note bad">This converter is not available yet.</p> : null}
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

function initialSettingsForRecipe(recipe: ConversionRecipe): ConversionSettings {
  return Object.fromEntries(recipe.editorControls.map((control) => [control, getControlOptions(recipe, control)[0] ?? "Auto"])) as ConversionSettings;
}

function getControlOptions(recipe: ConversionRecipe, control: EditorControl) {
  return recipe.controlOptions?.[control] ?? DEFAULT_CONTROL_OPTIONS[control] ?? ["Auto"];
}

function controlLabel(control: string) {
  return (
    {
      outputFormat: "Output",
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
