import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FileType2, Search, Sparkles } from "lucide-react";
import { DropVortex } from "./components/DropVortex";
import { RecipeCard } from "./components/RecipeCard";
import { DEFAULT_CONTROL_OPTIONS, filterRecipesByQuery, recipeCategories, recipeOutputs, recipesForFamily } from "./data/conversionMatrix";
import { formatBytes, formatDuration, inspectFile } from "./lib/fileInspection";
import { canRunRecipe, convertRecipe, downloadOutput } from "./lib/conversions";
import { getDeviceProfile, preflightRecipe } from "./lib/preflight";
import type { ConversionRecipe, ConversionSettings, DeviceProfile, EditorControl, FileInspection, PreflightResult } from "./lib/types";

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

  async function runConversion(recipe: ConversionRecipe, settings: ConversionSettings) {
    if (!sourceFile || !inspection) {
      throw new Error("Choose a file first.");
    }

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
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="Omni Converter">
        <img src={`${import.meta.env.BASE_URL}android-chrome-192x192.png`} alt="" />
      </a>
      <p className="topline-promise">Convert any file to any file.</p>
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
  const [category, setCategory] = useState("all");
  const [output, setOutput] = useState("all");
  const categories = useMemo(() => recipeCategories(recipes), [recipes]);
  const outputs = useMemo(() => recipeOutputs(recipes), [recipes]);
  const visibleRecipes = useMemo(() => {
    return filterRecipesByQuery(recipes, query).filter((recipe) => {
      const categoryMatch = category === "all" || recipe.category === category;
      const outputMatch = output === "all" || recipe.output === output;
      return categoryMatch && outputMatch;
    });
  }, [category, output, query, recipes]);
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
  const runnable = canRunRecipe(recipe);
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
