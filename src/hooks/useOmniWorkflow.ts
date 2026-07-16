import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fileLaunchBridge } from "../core/fileLaunchQueue";
import type { ConversionJob, JobController, JobError } from "../core/jobs";
import { engineCanCancel, engineForRecipe } from "../engines/registry";
import type { EngineResult } from "../engines/types";
import { getDeviceProfile, preflightRecipe } from "../lib/preflight";
import type { ConversionRecipe, ConversionSettings, DeviceProfile, FileInspection, PreflightResult } from "../lib/types";

export type OmniWorkflowStage = "drop" | "analyzing" | "choose" | "edit" | "processing" | "results";
type ConversionCatalog = Awaited<ReturnType<typeof import("../core/catalog")["loadConversionCatalog"]>>;

export interface OmniWorkflowOptions {
  createController?: () => JobController;
  supportsCancellation?: (recipe: ConversionRecipe) => boolean;
  prepareEngines?: () => Promise<unknown>;
}

export interface ConversionJobInput {
  file: File;
  inspection: FileInspection;
  recipe: ConversionRecipe;
  settings: ConversionSettings;
}

export type ConversionRunOutcome =
  | { status: "complete"; job: ConversionJob; outputs: EngineResult }
  | { status: "failed"; job: ConversionJob; error: JobError };

export async function executeConversionJob(
  input: ConversionJobInput,
  createController?: () => JobController
): Promise<ConversionRunOutcome> {
  const controller = createController?.() ?? (await import("../core/jobs")).createJobController();
  const created = controller.create(input);
  const job = await controller.start(created.id);
  const outputs = controller.getResult(created.id);
  if (job.state === "complete" && outputs?.length) return { status: "complete", job, outputs };
  return {
    status: "failed",
    job,
    error: job.error ?? {
      name: "MissingJobResultError",
      message: "The conversion did not produce a validated result.",
      at: job.updatedAt
    }
  };
}

async function prepareConversionEngines() {
  await import("../lib/conversions");
}

function errorFacts(error: unknown): JobError {
  return {
    name: error instanceof Error && error.name ? error.name : "ConversionError",
    message: error instanceof Error ? error.message : "This conversion could not finish.",
    at: new Date().toISOString()
  };
}

export function useOmniWorkflow(options: OmniWorkflowOptions = {}) {
  const [stage, setStage] = useState<OmniWorkflowStage>("drop");
  const [dragActive, setDragActive] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<FileInspection | null>(null);
  const [device, setDevice] = useState<DeviceProfile | null>(null);
  const [catalog, setCatalog] = useState<ConversionCatalog | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [job, setJob] = useState<ConversionJob | null>(null);
  const [outputs, setOutputs] = useState<EngineResult>([]);
  const [error, setError] = useState<JobError | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const controllerRef = useRef<JobController | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const inputAttemptRef = useRef(0);
  const activeJobRef = useRef<{ controller: JobController; id: string; eventToken: number; runToken: number } | null>(null);
  const eventTokenRef = useRef(0);
  const workflowTokenRef = useRef(0);

  const recipes = useMemo(() => (inspection && catalog ? catalog.browserRecipesForInspection(inspection) : []), [catalog, inspection]);
  const preflights = useMemo(() => {
    const map = new Map<string, PreflightResult>();
    if (!inspection || !device) return map;
    recipes.forEach((recipe) => map.set(recipe.id, preflightRecipe(recipe, inspection, device)));
    return map;
  }, [device, inspection, recipes]);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null;
  const selectedPreflight = selectedRecipe ? preflights.get(selectedRecipe.id) ?? null : null;

  const clearController = useCallback(() => {
    const active = activeJobRef.current;
    workflowTokenRef.current += 1;
    eventTokenRef.current += 1;
    activeJobRef.current = null;
    if (active) active.controller.cancel(active.id);
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    controllerRef.current = null;
  }, []);

  useEffect(() => clearController, [clearController]);

  const finishWithError = useCallback((nextError: JobError) => {
    setOutputs([]);
    setError(nextError);
    setStage("results");
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const attempt = inputAttemptRef.current + 1;
    inputAttemptRef.current = attempt;
    clearController();
    const workflowToken = workflowTokenRef.current;
    setStage("analyzing");
    setDragActive(false);
    setSourceFile(file);
    setInspection(null);
    setDevice(null);
    setSelectedRecipeId(null);
    setJob(null);
    setOutputs([]);
    setError(null);
    setCanCancel(false);

    try {
      const [nextInspection, nextCatalog, nextDevice] = await Promise.all([
        import("../lib/fileInspection").then(({ inspectFile }) => inspectFile(file)),
        import("../core/catalog").then(({ loadConversionCatalog }) => loadConversionCatalog()),
        getDeviceProfile()
      ]);
      if (inputAttemptRef.current !== attempt || workflowTokenRef.current !== workflowToken) return;
      setInspection(nextInspection);
      setCatalog(nextCatalog);
      setDevice(nextDevice);
      setStage("choose");
    } catch (nextError) {
      if (inputAttemptRef.current !== attempt || workflowTokenRef.current !== workflowToken) return;
      finishWithError(errorFacts(nextError));
    }
  }, [clearController, finishWithError]);

  useEffect(() => fileLaunchBridge.subscribe(handleFile), [handleFile]);

  const handleJobEvent = useCallback((controller: JobController, runToken: number, event: { job: ConversionJob }) => {
    const active = activeJobRef.current;
    if (!active || workflowTokenRef.current !== runToken || active.runToken !== runToken || active.controller !== controller || active.id !== event.job.id || active.eventToken !== eventTokenRef.current) return;
    setJob(event.job);
    if (event.job.state === "complete") {
      const result = controller.getResult(event.job.id);
      if (!result?.length) {
        finishWithError({
          name: "MissingJobResultError",
          message: "The conversion did not produce a validated result.",
          at: event.job.updatedAt
        });
        return;
      }
      setOutputs(result);
      setError(null);
      setStage("results");
      activeJobRef.current = null;
    } else if (event.job.state === "failed") {
      setOutputs([]);
      setError(event.job.error ?? {
        name: "ConversionError",
        message: "This conversion could not finish.",
        at: event.job.updatedAt
      });
      setStage("results");
      activeJobRef.current = null;
    } else if (event.job.state === "canceled") {
      setOutputs([]);
      setError(null);
      setStage("results");
      activeJobRef.current = null;
    }
  }, [finishWithError]);

  const startConversion = useCallback(async (recipe: ConversionRecipe, settings: ConversionSettings) => {
    if (!sourceFile || !inspection) {
      finishWithError(errorFacts(new Error("Choose a file first.")));
      return;
    }

    clearController();
    const runToken = workflowTokenRef.current;
    setStage("processing");
    setOutputs([]);
    setError(null);
    setCanCancel(false);

    try {
      const [, jobs] = await Promise.all([
        (options.prepareEngines ?? prepareConversionEngines)(),
        options.createController ? Promise.resolve(null) : import("../core/jobs")
      ]);
      if (workflowTokenRef.current !== runToken) return;
      const controller = options.createController?.() ?? jobs!.createJobController();
      if (workflowTokenRef.current !== runToken) return;
      controllerRef.current = controller;
      const created = controller.create({ file: sourceFile, inspection, recipe, settings });
      if (workflowTokenRef.current !== runToken) return;
      const token = eventTokenRef.current + 1;
      eventTokenRef.current = token;
      activeJobRef.current = { controller, id: created.id, eventToken: token, runToken };
      unsubscribeRef.current = controller.subscribe((event) => handleJobEvent(controller, runToken, event));
      if (workflowTokenRef.current !== runToken) {
        clearController();
        return;
      }
      setJob(created);
      setCanCancel(options.supportsCancellation?.(recipe) ?? engineCanCancel(engineForRecipe(recipe)));
      if (workflowTokenRef.current !== runToken) {
        clearController();
        return;
      }
      void controller.start(created.id).catch((nextError) => {
        const active = activeJobRef.current;
        if (workflowTokenRef.current === runToken && active?.controller === controller && active.id === created.id) finishWithError(errorFacts(nextError));
      });
    } catch (nextError) {
      if (workflowTokenRef.current === runToken) finishWithError(errorFacts(nextError));
    }
  }, [clearController, finishWithError, handleJobEvent, inspection, options, sourceFile]);

  const cancel = useCallback(() => {
    if (!job || !controllerRef.current) return;
    if (controllerRef.current.cancel(job.id)) {
      const nextJob = controllerRef.current.get(job.id);
      if (nextJob) setJob(nextJob);
    }
  }, [job]);

  const retry = useCallback(() => {
    if (!job || !controllerRef.current) {
      if (sourceFile) void handleFile(sourceFile);
      return;
    }
    setStage("processing");
    setOutputs([]);
    setError(null);
    const token = eventTokenRef.current + 1;
    eventTokenRef.current = token;
    activeJobRef.current = { controller: controllerRef.current, id: job.id, eventToken: token, runToken: workflowTokenRef.current };
    void controllerRef.current.retry(job.id).catch((nextError) => finishWithError(errorFacts(nextError)));
  }, [finishWithError, handleFile, job, sourceFile]);

  const selectRecipe = useCallback((recipe: ConversionRecipe) => {
    setSelectedRecipeId(recipe.id);
    setStage("edit");
  }, []);

  const restart = useCallback(() => {
    inputAttemptRef.current += 1;
    clearController();
    setStage("drop");
    setDragActive(false);
    setSourceFile(null);
    setInspection(null);
    setDevice(null);
    setSelectedRecipeId(null);
    setJob(null);
    setOutputs([]);
    setError(null);
    setCanCancel(false);
  }, [clearController]);

  const backFromResults = useCallback(() => {
    if (inspection && selectedRecipe) {
      setStage("edit");
      return;
    }
    if (inspection && catalog) {
      setStage("choose");
      return;
    }
    restart();
  }, [catalog, inspection, restart, selectedRecipe]);

  return {
    stage,
    dragActive,
    sourceFile,
    inspection,
    device,
    catalog,
    recipes,
    preflights,
    selectedRecipe,
    selectedPreflight,
    job,
    outputs,
    error,
    canCancel,
    setDragActive,
    handleFile,
    selectRecipe,
    startConversion,
    cancel,
    retry,
    restart,
    backToChoose: () => setStage("choose"),
    backFromResults
  };
}
