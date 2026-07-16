import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import App, { EditScreen } from "../../src/App";
import { ControlSurface } from "../../src/components/ControlSurface";
import "../../src/styles.css";
import { createJobController } from "../../src/core/jobs";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import type { ConversionEngine } from "../../src/engines/types";
import type { Capability, ConversionRecipe, ConversionSettings, DeviceProfile, EditorControl, FileInspection } from "../../src/lib/types";

const mode = new URLSearchParams(window.location.search).get("mode");
const stateKey = "omni-workflow-harness";

const SIX_CONTROL_RECIPE: ConversionRecipe = {
  id: "six-control-layout",
  input: ["image"],
  category: "Image",
  output: "PNG",
  title: "Six control layout",
  description: "Wide control-surface fixture.",
  treatments: [],
  editorControls: ["outputFormat", "crop", "resolution", "color", "compression", "metadata"],
  controlOptions: {
    outputFormat: ["Portable Network Graphics with a deliberately long readable label"],
    crop: ["Keep the complete source canvas"],
    resolution: ["3840 by 2160 pixels"],
    color: ["Display P3 wide gamut"],
    compression: ["Maximum quality with lossless metadata"],
    metadata: ["Keep descriptive and copyright fields"]
  },
  requiredCapabilities: [],
  intensity: "light",
  engine: "workflow-test-engine",
  implementation: "ready",
  maturity: "verified",
  runtimes: ["browser"],
  localOnly: true
};

const VIDEO_PREFLIGHT_RECIPE = CONVERSION_RECIPES.find((recipe) => recipe.id === "video-to-mp4")!;
const VIDEO_PREFLIGHT_INSPECTION: FileInspection = {
  name: "feature.mp4",
  extension: "mp4",
  mime: "video/mp4",
  size: 500_000_000,
  family: "video",
  exactFormat: "mp4",
  duration: 60 * 60,
  width: 1920,
  height: 1080,
  sampleRate: 48_000,
  audioChannels: 2,
  notes: []
};
const VIDEO_PREFLIGHT_DEVICE: DeviceProfile = {
  cores: 8,
  memoryGb: 16,
  supports: { video: true, webcodecs: true, worker: true } as Record<Capability, boolean>
};

interface HarnessState {
  aborts: number;
  starts: number;
  preparations: number;
  prepared: number;
  controllers: number;
  jobs: number;
  unhandled: number;
}

function loadState(): HarnessState {
  try {
    const stored = JSON.parse(window.localStorage.getItem(stateKey) ?? "{}") as Partial<HarnessState>;
    return {
      aborts: stored.aborts ?? 0,
      starts: stored.starts ?? 0,
      preparations: stored.preparations ?? 0,
      prepared: stored.prepared ?? 0,
      controllers: stored.controllers ?? 0,
      jobs: stored.jobs ?? 0,
      unhandled: stored.unhandled ?? 0
    };
  } catch {
    return { aborts: 0, starts: 0, preparations: 0, prepared: 0, controllers: 0, jobs: 0, unhandled: 0 };
  }
}

function storeState(update: (state: HarnessState) => HarnessState) {
  const state = update(loadState());
  window.localStorage.setItem(stateKey, JSON.stringify(state));
  window.dispatchEvent(new Event("workflow-harness-change"));
  return state;
}

async function validPng(name = "fresh.png") {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Harness canvas is unavailable.");
  context.fillStyle = "#0b5d50";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#d6a54f";
  context.fillRect(0, 0, 8, canvas.height);
  context.fillStyle = "#b84445";
  context.fillRect(8, 0, 8, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Harness PNG encoding failed.")), "image/png"));
  return { name, blob };
}

let releasePreparation = () => {};

async function prepareEngines() {
  if (mode !== "prepare-delay") {
    await import("../../src/lib/conversions");
    return;
  }
  storeState((state) => ({ ...state, preparations: state.preparations + 1 }));
  await new Promise<void>((resolve) => {
    releasePreparation = resolve;
  });
  storeState((state) => ({ ...state, prepared: state.prepared + 1 }));
}

function createHarnessController() {
  storeState((state) => ({ ...state, controllers: state.controllers + 1 }));
  const controller = createJobController(() => engine);
  return {
    ...controller,
    create(input: Parameters<typeof controller.create>[0]) {
      storeState((state) => ({ ...state, jobs: state.jobs + 1 }));
      return controller.create(input);
    }
  };
}

if (mode === "folder-write-fail") {
  (window as Window & { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker = async () => ({
    getFileHandle: async () => ({
      createWritable: async () => ({
        write: async () => { throw new Error("Harness folder write failed."); },
        close: async () => {},
        abort: async () => {}
      })
    })
  });
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    storeState((state) => ({ ...state, unhandled: state.unhandled + 1 }));
  });
}

const engine: ConversionEngine = {
  id: "workflow-test-engine",
  runtimes: ["browser"],
  cancellation: "cooperative",
  ownsRecipe: () => true,
  async convert(context) {
    storeState((state) => ({ ...state, starts: state.starts + 1 }));
    context.reportProgress({ completed: 1, total: 4, label: "Preparing test output" });
    if (mode === "fail") {
      throw Object.assign(new Error("Test conversion failed."), { name: "TestEngineError" });
    }
    if (mode === "fail-once" && loadState().starts === 1) {
      throw Object.assign(new Error("Test conversion failed once."), { name: "TestEngineError" });
    }
    if (mode === "fail-once") return [await validPng()];
    if (mode === "hostile") {
      return [{ name: "hostile.html", blob: new Blob(['<!doctype html><html><body><img src=x onerror="window.__hostileExecuted = true"></body></html>'], { type: "text/html" }) }];
    }
    if (mode === "multi") {
      return [await validPng("first.png"), { name: "notes.txt", blob: new Blob(["ready"], { type: "text/plain" }) }];
    }
    if (mode === "folder-write-fail") return [await validPng()];
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, mode === "delay" ? 7_000 : 2_000);
      context.signal.addEventListener("abort", () => {
        window.clearTimeout(timer);
        storeState((state) => ({ ...state, aborts: state.aborts + 1 }));
        window.setTimeout(() => reject(new DOMException("Test work aborted.", "AbortError")), 120);
      }, { once: true });
    });
    context.reportProgress({ completed: 4, total: 4, label: "Finishing test output" });
    return [{ name: "late.pdf", blob: new Blob(["late"], { type: "application/pdf" }) }];
  }
};

function Harness() {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState(loadState());
  useEffect(() => {
    const refresh = () => setState(loadState());
    window.addEventListener("workflow-harness-change", refresh);
    return () => window.removeEventListener("workflow-harness-change", refresh);
  }, []);
  if (mode === "controls-six") return <SixControlHarness />;
  if (mode === "video-preflight") return <VideoPreflightHarness />;
  return <><div data-harness-controls="true" style={{ position: "fixed", top: 0, left: 0, zIndex: 30 }}><button type="button" onClick={() => { setVersion((current) => current + 1); window.setTimeout(() => setState(loadState()), 0); }}>Replace workflow</button><button type="button" onClick={() => releasePreparation()}>Release preparation</button><output data-testid="abort-count">{state.aborts}</output><output data-testid="preparation-count">{state.preparations}</output><output data-testid="prepared-count">{state.prepared}</output><output data-testid="controller-count">{state.controllers}</output><output data-testid="job-count">{state.jobs}</output><output data-testid="unhandled-count">{state.unhandled}</output></div><App key={version} createController={createHarnessController} supportsCancellation={() => true} prepareEngines={prepareEngines} /></>;
}

function SixControlHarness() {
  const [settings, setSettings] = useState<ConversionSettings>({});
  const options = (recipe: ConversionRecipe, control: EditorControl) => recipe.controlOptions?.[control] ?? ["Auto"];
  return <main className="app-shell stage-edit" style={{ display: "grid", placeItems: "center", padding: "2rem" }}><div className="edit-layout"><ControlSurface recipe={SIX_CONTROL_RECIPE} preflight={null} settings={settings} getOptions={options} getLabel={(control) => control} onChange={(control, value) => setSettings((current) => ({ ...current, [control]: value }))} onConvert={() => {}} onRestart={() => {}} unavailable={false} /></div></main>;
}

function VideoPreflightHarness() {
  return <main className="app-shell stage-edit"><EditScreen inspection={VIDEO_PREFLIGHT_INSPECTION} recipe={VIDEO_PREFLIGHT_RECIPE} device={VIDEO_PREFLIGHT_DEVICE} preflight={null} onConvert={() => {}} onBack={() => {}} onRestart={() => {}} /></main>;
}

const harnessWindow = window as Window & { __omniHarnessRoot?: ReturnType<typeof createRoot> };
harnessWindow.__omniHarnessRoot ??= createRoot(document.getElementById("root")!);
harnessWindow.__omniHarnessRoot.render(<Harness />);
