import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FileType2, Search, Sparkles } from "lucide-react";
import { DropVortex } from "./components/DropVortex";
import { ControlSurface } from "./components/ControlSurface";
import { MediaWorkbench } from "./components/MediaWorkbench";
import { ProcessingScreen } from "./components/ProcessingScreen";
import { RecipeCard } from "./components/RecipeCard";
import { ResultScreen } from "./components/ResultScreen";
import { formatBytes, formatDuration } from "./lib/fileInspection";
import { pageSelectionOptionsForDocument } from "./lib/pdfPageOptions";
import { sheetSelectionOptionsForWorkbook } from "./lib/tabularOptions";
import { slideSelectionOptionsForPresentation } from "./lib/presentationOptions";
import { archiveSelectionOptionsForInspection } from "./lib/archiveOptions";
import { preflightRecipe } from "./lib/preflight";
import type { ConversionRecipe, ConversionSettings, DeviceProfile, EditorControl, FileInspection, PreflightResult } from "./lib/types";
import { useOmniWorkflow, type OmniWorkflowOptions } from "./hooks/useOmniWorkflow";

export { executeConversionJob } from "./hooks/useOmniWorkflow";
export type { ConversionJobInput, ConversionRunOutcome } from "./hooks/useOmniWorkflow";

type ConversionCatalog = typeof import("./data/conversionMatrix");

export type AppProps = OmniWorkflowOptions;

const DEFAULT_CONTROL_OPTIONS: Record<EditorControl, string[]> = {
  archiveSelection: ["All files", "Top-level files", "Documents", "Images", "Audio and video"],
  outputFormat: ["Auto", "PNG", "JPEG", "WebP", "AVIF", "PDF", "TXT", "Markdown", "HTML", "ZIP"],
  timeline: ["Full file", "Marked range", "Current clip", "Intro only", "Outro only", "Custom marks"], trim: ["None", "Start/end handles", "First 5 seconds", "First 15 seconds", "First 30 seconds", "Custom range"], crop: ["None", "Fit entire source", "Fill target", "Center crop", "Trim transparent edges", "Safe social crop", "Custom crop"], rotation: ["90 degrees clockwise", "180 degrees", "90 degrees counterclockwise"], aspectRatio: ["Original", "1:1 square", "4:5 portrait", "16:9 widescreen", "9:16 vertical", "A4 page", "Letter page", "Custom"], resolution: ["Original", "512 px", "1024 px", "1080 px", "1920 px", "2K", "4K", "150 DPI", "300 DPI", "Custom"], frameRate: ["Source", "12 fps", "24 fps", "30 fps", "60 fps", "Custom"], frameInterval: ["Every frame", "Every 1 second", "Every 2 seconds", "Every 5 seconds", "Every 10 seconds", "Scene changes", "Custom interval"], chapterInterval: ["None", "Every minute", "Every 2 minutes", "Every 5 minutes", "Detected chapters", "Custom chapter marks"], audioGain: ["Keep source", "Normalize", "-6 dB", "-3 dB", "+3 dB", "+6 dB", "Mute", "Custom"], audioFade: ["None", "Fade in", "Fade out", "Fade in and out", "Crossfade clips", "Custom"], sampleRate: ["Source sample rate", "44.1 kHz", "48 kHz", "96 kHz"], audioChannels: ["Source channels", "Mono", "Stereo"], bitDepth: ["16-bit PCM", "24-bit PCM", "32-bit float"], waveform: ["None", "PNG waveform", "SVG waveform", "Audiogram background", "Timeline peaks JSON"], captions: ["None", "Import SRT", "Import VTT", "Export SRT", "Export VTT", "Burn in later", "Transcript package"], color: ["Original", "sRGB", "Display P3", "Grayscale", "Transparent matte", "White matte", "Black matte"], compression: ["Lossless", "Maximum quality", "High quality", "Balanced", "Small file", "Tiny preview", "Custom"], dataTypes: ["Preserve detected types", "Infer CSV value types", "Convert all values to text"], formulaSafety: ["Protect spreadsheet formulas", "Preserve exact text"], headerMode: ["First row is headers", "No header row"], pageOrder: ["All pages", "Current page", "First page", "Last page", "Odd pages", "Even pages", "Custom range", "Split every page"], pageLayout: ["2 pages per sheet", "4 pages per sheet"], pageSize: ["Auto", "Original", "Letter", "Legal", "A4", "A5", "16:9 slide", "4:5 carousel", "1:1 square", "Custom"], sheetSelection: ["All sheets", "First sheet"], slideSelection: ["All slides", "First slide", "Last slide", "Odd slides", "Even slides", "Reverse order"], margins: ["None", "Narrow", "Standard", "Wide", "Bleed", "Safe area", "Custom"], metadata: ["Keep", "Strip", "Inspect report", "Normalize", "Rename title", "Redact hidden fields"], watermark: ["None", "Text watermark", "Image watermark", "Page number", "Date stamp", "Custom"], batchNaming: ["Keep source name", "Clean filename", "Numbered sequence", "Page number suffix", "Size suffix", "Date suffix", "Custom pattern"], bundle: ["Single file", "ZIP", "ZIP with manifest", "ZIP with README", "Folder by page", "Folder by format", "Checksum manifest"]
};

export default function App(props: AppProps) {
  const workflow = useOmniWorkflow(props);
  useOmniPerformance(workflow.stage);
  return <main className={`app-shell stage-${workflow.stage}`}><Topbar />
    {workflow.stage === "drop" ? <section className="screen drop-screen"><DropVortex active={workflow.dragActive} fileLoaded={false} onFile={workflow.handleFile} onDragActive={workflow.setDragActive} /></section> : null}
    {workflow.stage === "analyzing" && workflow.sourceFile ? <AnalyzeScreen name={workflow.sourceFile.name} /> : null}
    {workflow.stage === "choose" && workflow.inspection && workflow.catalog ? <ChooseScreen catalog={workflow.catalog} inspection={workflow.inspection} recipes={workflow.recipes} preflights={workflow.preflights} onSelect={workflow.selectRecipe} onBack={workflow.restart} /> : null}
    {workflow.stage === "edit" && workflow.sourceFile && workflow.inspection && workflow.selectedRecipe ? <EditScreen sourceFile={workflow.sourceFile} inspection={workflow.inspection} recipe={workflow.selectedRecipe} device={workflow.device} preflight={workflow.selectedPreflight} onConvert={workflow.startConversion} onBack={workflow.backToChoose} onRestart={workflow.restart} /> : null}
    {workflow.stage === "processing" ? <ProcessingScreen job={workflow.job} estimate={workflow.selectedPreflight} canCancel={workflow.canCancel} onCancel={workflow.cancel} /> : null}
    {workflow.stage === "results" ? <ResultScreen job={workflow.job} outputs={workflow.outputs} error={workflow.error} onRetry={workflow.retry} onBack={workflow.backFromResults} onConvertAnotherWay={workflow.backToChoose} onStartOver={workflow.restart} /> : null}
  </main>;
}

function Topbar() { return <nav className="topbar"><a className="brand" href={import.meta.env.BASE_URL} aria-label="Omni Converter"><img src={`${import.meta.env.BASE_URL}favicon-48x48.png`} alt="" /></a><p className="topline-promise" aria-hidden="true">Convert any file to any file</p></nav>; }
function AnalyzeScreen({ name }: { name: string }) { return <section className="screen analyze-screen"><div className="analysis-card"><Sparkles size={18} /><span>Reading file</span><b>{name}</b><i /></div></section>; }

function ChooseScreen({ catalog, inspection, recipes, preflights, onSelect, onBack }: { catalog: ConversionCatalog; inspection: FileInspection; recipes: ConversionRecipe[]; preflights: Map<string, PreflightResult>; onSelect: (recipe: ConversionRecipe) => void; onBack: () => void }) {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("all"); const [output, setOutput] = useState("all");
  const categories = useMemo(() => catalog.recipeCategories(recipes), [catalog, recipes]); const outputs = useMemo(() => catalog.recipeOutputs(recipes), [catalog, recipes]);
  const visibleRecipes = useMemo(() => catalog.filterRecipesByQuery(recipes, query).filter((recipe) => (category === "all" || recipe.category === category) && (output === "all" || recipe.output === output)), [catalog, category, output, query, recipes]);
  const countLabel = query.trim() ? `${visibleRecipes.length} of ${recipes.length} conversions` : `${recipes.length} available conversions`;
  return <section className="screen choose-screen"><button className="back-button" type="button" onClick={onBack}><ChevronLeft size={16} />New file</button><FileHeader inspection={inspection} /><div className="stage-copy"><span>{countLabel}</span><h1>What should it become?</h1></div><label className="conversion-search"><Search size={15} /><input aria-label="Search conversions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversions: jpg, web, icon, pdf, embed..." /></label><div className="conversion-filters" aria-label="Conversion filters"><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span>Output</span><select value={output} onChange={(event) => setOutput(event.target.value)}><option value="all">All outputs</option>{outputs.map((item) => <option value={item} key={item}>{item}</option>)}</select></label></div><div className="recipe-stage-grid">{visibleRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} preflight={preflights.get(recipe.id) ?? null} selected={false} onSelect={() => onSelect(recipe)} />)}{!visibleRecipes.length ? <p className="empty-results">No matching conversion. Try a format name like PNG, PDF, JPG, WebP, icon, embed, or ZIP.</p> : null}</div></section>;
}

export function EditScreen({ sourceFile = null, inspection, recipe, device, preflight, onConvert, onBack, onRestart }: { sourceFile?: File | null; inspection: FileInspection; recipe: ConversionRecipe; device: DeviceProfile | null; preflight: PreflightResult | null; onConvert: (recipe: ConversionRecipe, settings: ConversionSettings) => void; onBack: () => void; onRestart: () => void }) {
  const [settings, setSettings] = useState<ConversionSettings>(() => initialSettingsForRecipe(recipe, inspection));
  const hasMediaWorkbench = Boolean(sourceFile && inspection.duration && (inspection.family === "audio" || inspection.family === "video") && recipe.editorControls.includes("trim"));
  const evaluatedPreflight = useMemo(
    () => device ? preflightRecipe(recipe, inspection, device, settings) : preflight,
    [device, inspection, preflight, recipe, settings]
  );
  const unavailable = evaluatedPreflight?.status === "blocked" || recipe.implementation !== "ready";
  return <section className="screen edit-screen"><button className="back-button" type="button" onClick={onBack}><ChevronLeft size={16} />Outputs</button><FileHeader inspection={inspection} /><div className={`edit-layout ${hasMediaWorkbench ? "media-edit-layout" : ""}`}><div className="stage-copy"><span>{recipe.category} / {recipe.output}</span><h1>{recipe.title}</h1><p>{recipe.description}</p></div>{hasMediaWorkbench && sourceFile ? <MediaWorkbench file={sourceFile} inspection={inspection} settings={settings} onSettingsChange={setSettings} /> : null}<ControlSurface recipe={recipe} preflight={evaluatedPreflight} settings={settings} getOptions={(selectedRecipe, control) => getControlOptions(selectedRecipe, control, inspection)} getLabel={controlLabel} onChange={(control, value) => setSettings((current) => ({ ...current, [control]: value }))} onConvert={() => onConvert(recipe, settings)} onRestart={onRestart} unavailable={unavailable} /></div></section>;
}

function FileHeader({ inspection }: { inspection: FileInspection }) { const details = [inspection.exactFormat && !["unknown", "unrecognized-media"].includes(inspection.exactFormat) ? inspection.exactFormat.toUpperCase() : inspection.extension ? inspection.extension.toUpperCase() : inspection.mime, formatBytes(inspection.size), inspection.pages ? `${inspection.pages} page${inspection.pages === 1 ? "" : "s"}` : null, inspection.sheets ? `${inspection.sheets.length} sheet${inspection.sheets.length === 1 ? "" : "s"}` : null, inspection.slides ? `${inspection.slides} slide${inspection.slides === 1 ? "" : "s"}` : null, inspection.archiveEntries ? `${inspection.archiveEntries.length} file${inspection.archiveEntries.length === 1 ? "" : "s"}` : null, inspection.width && inspection.height ? `${inspection.width} x ${inspection.height}` : null, inspection.sampleRate ? `${inspection.sampleRate} Hz` : null, inspection.audioChannels ? `${inspection.audioChannels} ch` : null, formatDuration(inspection.duration)].filter(Boolean); return <div className="file-header"><FileType2 size={16} /><b>{inspection.name}</b><span>{details.join(" / ")}</span></div>; }
function initialSettingsForRecipe(recipe: ConversionRecipe, inspection?: FileInspection): ConversionSettings { return Object.fromEntries(recipe.editorControls.map((control) => [control, getControlOptions(recipe, control, inspection)[0] ?? "Auto"])) as ConversionSettings; }
function getControlOptions(recipe: ConversionRecipe, control: EditorControl, inspection?: FileInspection) { const baseOptions = recipe.controlOptions?.[control] ?? DEFAULT_CONTROL_OPTIONS[control] ?? ["Auto"]; if (control === "archiveSelection" && inspection?.family === "archive") return archiveSelectionOptionsForInspection(baseOptions, inspection.archiveEntries); if (control === "outputFormat" && recipe.id === "audio-to-video" && inspection?.mediaTargets) return baseOptions.filter((option) => (option !== "MP4" || inspection.mediaTargets?.mp4) && (option !== "WebM" || inspection.mediaTargets?.webm)); if (control === "pageOrder" && inspection?.family === "pdf" && recipe.id !== "pdf-reorder-pages") return pageSelectionOptionsForDocument(baseOptions, inspection.pages); if (control === "sheetSelection" && inspection?.family === "spreadsheet") return sheetSelectionOptionsForWorkbook(baseOptions, inspection.sheets); if (control === "slideSelection" && inspection?.family === "presentation") return slideSelectionOptionsForPresentation(baseOptions, inspection.slides); return baseOptions; }
function controlLabel(control: string) { return ({ archiveSelection: "Files", outputFormat: "Output", timeline: "Timeline", trim: "Trim", crop: "Crop", rotation: "Rotation", aspectRatio: "Aspect ratio", resolution: "Resolution", frameRate: "Frame rate", frameInterval: "Frame interval", chapterInterval: "Chapters", audioGain: "Volume", audioFade: "Fades", sampleRate: "Sample rate", audioChannels: "Channels", bitDepth: "Bit depth", waveform: "Waveform", captions: "Captions", color: "Color", compression: "Compression", dataTypes: "Value types", formulaSafety: "Formula safety", headerMode: "Headers", pageOrder: "Pages", pageLayout: "Layout", pageSize: "Page size", sheetSelection: "Sheets", slideSelection: "Slides", margins: "Margins", metadata: "Details", watermark: "Watermark", batchNaming: "Names", bundle: "Bundle" }[control] ?? control); }

function useOmniPerformance(stage: string) {
  useEffect(() => {
    document.querySelector(".prepaint-promise")?.remove();
    const metrics = { longTasks: [] as number[], totalBlockingTime: 0, screens: [stage] };
    window.__omniPerformance = metrics;
    if (!("PerformanceObserver" in window)) return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        metrics.longTasks.push(entry.duration);
        metrics.totalBlockingTime += Math.max(0, entry.duration - 50);
      }
    });
    observer.observe({ type: "longtask", buffered: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.__omniPerformance?.screens.push(stage);
    performance.mark(`omni:stage:${stage}`);
  }, [stage]);
}

declare global {
  interface Window {
    __omniPerformance?: { longTasks: number[]; totalBlockingTime: number; screens: string[] };
  }
}
