import { engineCanCancel, engineForRecipe } from "../engines/registry";
import type { ConversionEngine, EngineResult } from "../engines/types";
import type { ConversionRecipe, ConversionSettings, FileInspection, RecipeRuntime } from "../lib/types";
import { validateOutputs, type OutputValidation } from "./outputValidation";

const ANALYSIS_WEIGHT = 0.1;
const CONVERSION_WEIGHT = 0.8;

export type JobState = "queued" | "analyzing" | "running" | "paused" | "canceling" | "canceled" | "failed" | "validating" | "complete";
export type JobProgressPhase = "queued" | "analysis" | "conversion" | "validation" | "complete";

export interface JobProgress {
  value: number;
  phase: JobProgressPhase;
  label?: string;
}

export interface JobError {
  name: string;
  message: string;
  at: string;
  validation?: readonly OutputValidation[];
}

export interface JobInputFacts {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

export interface JobResourceReference {
  id: string;
}

export interface JobOutput {
  name: string;
  type: string;
  size: number;
  resource: JobResourceReference;
  validation?: OutputValidation;
}

export interface ConversionJob {
  id: string;
  attempt: number;
  state: JobState;
  source: JobResourceReference;
  input: JobInputFacts;
  inspection: FileInspection;
  recipe: ConversionRecipe;
  settings: ConversionSettings;
  runtime: RecipeRuntime;
  progress: JobProgress;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
  error?: JobError;
  outputs: readonly JobOutput[];
}

export interface CreateConversionJobInput {
  file: File;
  source?: JobResourceReference;
  inspection: FileInspection;
  recipe: ConversionRecipe;
  settings?: ConversionSettings;
  runtime?: RecipeRuntime;
}

export interface JobSourceHydration {
  resource: JobResourceReference;
  file: File;
}

export interface JobOutputHydration {
  resource: JobResourceReference;
  output: EngineResult[number];
}

export interface JobHydration {
  source?: JobSourceHydration;
  outputs?: readonly JobOutputHydration[];
}

export interface JobEvent {
  type: "created" | "updated";
  job: ConversionJob;
  previous?: ConversionJob;
}

export type EngineResolver = (recipe: ConversionRecipe, runtime: RecipeRuntime) => ConversionEngine;
export type JobListener = (event: JobEvent) => void;
export type OutputValidator = (outputs: EngineResult) => Promise<OutputValidation[]>;

export interface JobControllerOptions {
  createId?: () => string;
  now?: () => string;
  onListenerError?: (error: unknown, event: JobEvent) => void;
  validateOutputs?: OutputValidator;
}

export interface JobController {
  create(input: CreateConversionJobInput): ConversionJob;
  get(id: string): ConversionJob | undefined;
  list(): readonly ConversionJob[];
  exportSnapshots(): readonly ConversionJob[];
  restore(jobs: readonly ConversionJob[]): readonly ConversionJob[];
  hydrate(id: string, resources: JobHydration): Promise<ConversionJob>;
  getResult(id: string): EngineResult | undefined;
  start(id: string): Promise<ConversionJob>;
  cancel(id: string): boolean;
  retry(id: string): Promise<ConversionJob>;
  subscribe(listener: JobListener): () => void;
}

interface JobRecord {
  job: ConversionJob;
  file?: File;
  engine?: ConversionEngine;
  abortController?: AbortController;
  result?: EngineResult;
  engineStarted: boolean;
}

const legalTransitions: Readonly<Record<JobState, readonly JobState[]>> = {
  queued: ["analyzing", "running"],
  analyzing: ["running", "failed"],
  running: ["paused", "canceling", "failed", "validating"],
  paused: ["running", "canceling", "failed"],
  canceling: ["canceled"],
  canceled: ["queued"],
  failed: ["queued"],
  validating: ["complete", "failed"],
  complete: []
};

export function createJobController(engineResolver: EngineResolver = engineForRecipe, options: JobControllerOptions = {}): JobController {
  const jobs = new Map<string, JobRecord>();
  const listeners = new Set<JobListener>();
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? defaultJobId;
  const validate = options.validateOutputs ?? validateOutputs;

  function create(input: CreateConversionJobInput) {
    const id = createId();
    if (jobs.has(id)) {
      throw new Error("A job already exists with id \"" + id + "\".");
    }

    const timestamp = now();
    const job = snapshot({
      id,
      attempt: 1,
      state: "queued" as const,
      source: copy(input.source ?? { id: id + ":source" }),
      input: {
        name: input.file.name,
        type: input.file.type,
        size: input.file.size,
        lastModified: input.file.lastModified
      },
      inspection: copy(input.inspection),
      recipe: copy(input.recipe),
      settings: copy(input.settings ?? {}),
      runtime: input.runtime ?? "browser",
      progress: { value: 0, phase: "queued" as const },
      createdAt: timestamp,
      updatedAt: timestamp,
      outputs: []
    });
    jobs.set(id, { job, file: input.file, engineStarted: false });
    emit("created", job);
    return job;
  }

  function get(id: string) {
    return jobs.get(id)?.job;
  }

  function list() {
    return Object.freeze([...jobs.values()].map((record) => record.job));
  }

  function exportSnapshots() {
    return list();
  }

  function restore(serializedJobs: readonly ConversionJob[]) {
    for (const serialized of serializedJobs) {
      if (jobs.has(serialized.id)) {
        throw new Error("A job already exists with id \"" + serialized.id + "\".");
      }
      const job = normalizeRestoredJob(serialized, now());
      jobs.set(job.id, { job, engineStarted: false });
      emit("created", job);
    }
    return list();
  }

  async function hydrate(id: string, resources: JobHydration) {
    const record = requiredRecord(id);
    const file = resources.source ? hydrateSource(record.job, resources.source) : undefined;
    const result = resources.outputs ? await hydrateOutputs(record.job, resources.outputs, validate) : undefined;
    if (file) {
      record.file = file;
    }
    if (result) {
      record.result = result;
    }
    return record.job;
  }

  function getResult(id: string) {
    const record = jobs.get(id);
    if (!record || record.job.state !== "complete" || !record.result) {
      return undefined;
    }
    return freezeResult(record.result);
  }

  async function start(id: string) {
    const record = requiredRecord(id);
    if (record.job.state !== "queued") {
      throw new Error("Job \"" + id + "\" cannot start from state \"" + record.job.state + "\".");
    }
    if (!record.file) {
      throw new Error("Job \"" + id + "\" has no hydrated source file.");
    }

    const attempt = record.job.attempt;
    if (record.engine) {
      return beginConversion(record, attempt, record.engine);
    }

    transition(record, "analyzing", {
      startedAt: now(),
      progress: { value: 0, phase: "analysis" }
    });

    try {
      const engine = engineResolver(record.job.recipe, record.job.runtime);
      if (!isCurrent(record, attempt)) return record.job;
      record.engine = engine;
      return beginConversion(record, attempt, engine);
    } catch (error) {
      if (!isCurrent(record, attempt) || isTerminal(record.job.state)) return record.job;
      fail(record, error);
      return record.job;
    }
  }

  async function beginConversion(record: JobRecord, attempt: number, engine: ConversionEngine) {
    const abortController = new AbortController();
    record.abortController = abortController;
    record.engineStarted = false;
    transition(record, "running", {
      startedAt: now(),
      progress: { value: Math.round(ANALYSIS_WEIGHT * 100), phase: "conversion" }
    });

    if (!isCurrentState(record, attempt, "running")) {
      return record.job;
    }

    record.engineStarted = true;
    try {
      const result = await engine.convert({
        file: record.file as File,
        inspection: record.job.inspection,
        recipe: record.job.recipe,
        settings: record.job.settings,
        signal: abortController.signal,
        reportProgress: (progress) => reportProgress(record, attempt, progress)
      });

      if (!isCurrent(record, attempt) || isTerminal(record.job.state)) return record.job;
      if (record.job.state === "canceling") {
        finishCanceled(record);
        return record.job;
      }

      record.result = cloneResult(result);
      transition(record, "validating", {
        progress: {
          value: Math.max(record.job.progress.value, 99),
          phase: "validation"
        },
        outputs: outputFacts(result, record.job.id, attempt)
      });
      const validation = await validate(record.result);
      if (!isCurrentState(record, attempt, "validating")) return record.job;
      if (validation.some((fact) => !fact.valid)) {
        fail(record, outputValidationError(validation));
        return record.job;
      }
      assertValidationMatchesResult(validation, record.result);
      transition(record, "complete", {
        completedAt: now(),
        progress: { value: 100, phase: "complete" },
        outputs: outputFacts(result, record.job.id, attempt, validation)
      });
    } catch (error) {
      if (!isCurrent(record, attempt) || isTerminal(record.job.state)) return record.job;
      if (record.job.state === "canceling") {
        finishCanceled(record);
        return record.job;
      }
      fail(record, error);
    }

    return record.job;
  }

  function cancel(id: string) {
    const record = jobs.get(id);
    if (!record || (record.job.state !== "running" && record.job.state !== "paused") || !record.engine || !engineCanCancel(record.engine)) {
      return false;
    }

    transition(record, "canceling", {
      progress: {
        value: record.job.progress.value,
        phase: record.job.progress.phase,
        label: record.job.progress.label
      }
    });
    record.abortController?.abort();
    record.result = undefined;
    if (!record.engineStarted) {
      finishCanceled(record);
    }
    return true;
  }

  async function retry(id: string) {
    const record = requiredRecord(id);
    if (record.job.state !== "failed" && record.job.state !== "canceled") {
      throw new Error("Job \"" + id + "\" cannot retry from state \"" + record.job.state + "\".");
    }
    if (!record.file) {
      throw new Error("Job \"" + id + "\" has no hydrated source file.");
    }

    const timestamp = now();
    const previous = record.job;
    const { error: _error, outputs: _outputs, startedAt: _startedAt, completedAt: _completedAt, canceledAt: _canceledAt, ...stable } = previous;
    record.job = snapshot({
      ...stable,
      attempt: previous.attempt + 1,
      state: "queued",
      updatedAt: timestamp,
      progress: { value: 0, phase: "queued" },
      outputs: []
    });
    record.result = undefined;
    record.abortController = undefined;
    record.engineStarted = false;
    emit("updated", record.job, previous);
    return start(id);
  }

  function subscribe(listener: JobListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function reportProgress(record: JobRecord, attempt: number, progress: { completed?: number; total?: number; label?: string }) {
    if (!isCurrentState(record, attempt, "running")) return;
    const ratio = progress.total && progress.total > 0 && Number.isFinite(progress.total) && Number.isFinite(progress.completed)
      ? clamp((progress.completed ?? 0) / progress.total, 0, 1)
      : 0;
    const mapped = Math.round((ANALYSIS_WEIGHT + CONVERSION_WEIGHT * ratio) * 100);
    const value = Math.max(record.job.progress.value, Math.min(mapped, 99));
    transition(record, "running", {
      progress: {
        value,
        phase: "conversion",
        label: progress.label
      }
    }, true);
  }

  function transition(record: JobRecord, state: JobState, changes: Partial<ConversionJob> = {}, allowSelf = false) {
    const previous = record.job;
    if (state !== previous.state && !legalTransitions[previous.state].includes(state)) {
      throw new Error("Illegal job transition from \"" + previous.state + "\" to \"" + state + "\".");
    }
    if (state === previous.state && !allowSelf) {
      throw new Error("Illegal job transition from \"" + previous.state + "\" to itself.");
    }

    record.job = snapshot({
      ...previous,
      ...changes,
      state,
      updatedAt: now()
    });
    emit("updated", record.job, previous);
  }

  function fail(record: JobRecord, error: unknown) {
    record.result = undefined;
    transition(record, "failed", {
      error: errorFacts(error, now()),
      outputs: [],
      progress: {
        value: Math.min(record.job.progress.value, 99),
        phase: record.job.progress.phase,
        label: record.job.progress.label
      }
    });
  }

  function finishCanceled(record: JobRecord) {
    if (record.job.state !== "canceling") return;
    transition(record, "canceled", {
      canceledAt: now(),
      outputs: []
    });
  }

  function emit(type: JobEvent["type"], job: ConversionJob, previous?: ConversionJob) {
    const event = snapshot({ type, job, previous }) as JobEvent;
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        try {
          options.onListenerError?.(error, event);
        } catch {
          // Listener diagnostics must not alter job execution.
        }
      }
    }
  }

  function requiredRecord(id: string) {
    const record = jobs.get(id);
    if (!record) throw new Error("Unknown job \"" + id + "\".");
    return record;
  }

  return { create, get, list, exportSnapshots, restore, hydrate, getResult, start, cancel, retry, subscribe };
}

function outputFacts(result: EngineResult, jobId: string, attempt: number, validation?: readonly OutputValidation[]): JobOutput[] {
  return result.map((output, index) => ({
    name: output.name,
    type: output.blob.type,
    size: output.blob.size,
    resource: { id: jobId + ":" + attempt + ":output:" + index },
    ...(validation ? { validation: validation[index] } : {})
  }));
}

function hydrateSource(job: ConversionJob, binding: JobSourceHydration) {
  if (binding.resource.id !== job.source.id) {
    throw new Error("Source binding does not match serialized source resource.");
  }
  const file = binding.file;
  if (file.name !== job.input.name || file.type !== job.input.type || file.size !== job.input.size || file.lastModified !== job.input.lastModified) {
    throw new Error("Source file does not match serialized input facts.");
  }
  return file;
}

async function hydrateOutputs(job: ConversionJob, bindings: readonly JobOutputHydration[], validate: OutputValidator): Promise<EngineResult> {
  if (job.state !== "complete") {
    throw new Error("Only completed jobs can hydrate output results.");
  }
  if (bindings.length !== job.outputs.length) {
    throw new Error("Output binding count does not match serialized outputs.");
  }

  const persistedResourceIds = new Set<string>();
  for (const persisted of job.outputs) {
    if (persistedResourceIds.has(persisted.resource.id)) {
      throw new Error("Duplicate persisted output resource.");
    }
    persistedResourceIds.add(persisted.resource.id);
  }

  const bindingsByResource = new Map<string, JobOutputHydration>();
  for (const binding of bindings) {
    if (bindingsByResource.has(binding.resource.id)) {
      throw new Error("Duplicate serialized output resource binding.");
    }
    bindingsByResource.set(binding.resource.id, binding);
  }

  const consumedBindings = new Set<string>();
  const result = job.outputs.map((persisted) => {
    const binding = bindingsByResource.get(persisted.resource.id);
    if (!binding) {
      throw new Error("Output binding does not match serialized output resource.");
    }
    const output = binding.output;
    if (output.name !== persisted.name || output.blob.type !== persisted.type || output.blob.size !== persisted.size) {
      throw new Error("Output binding does not match serialized output metadata.");
    }
    consumedBindings.add(persisted.resource.id);
    return { name: output.name, blob: output.blob };
  });
  if (consumedBindings.size !== bindingsByResource.size) {
    throw new Error("Output hydration contains an unconsumed resource binding.");
  }
  const cloned = cloneResult(result);
  const validation = await validate(cloned);
  if (validation.some((fact) => !fact.valid)) throw outputValidationError(validation);
  assertValidationMatchesResult(validation, cloned);
  assertValidationMatchesPersistedFacts(validation, job.outputs);
  return cloned;
}

function normalizeRestoredJob(serialized: ConversionJob, timestamp: string): ConversionJob {
  const job = snapshot(serialized);
  if (!isRestoredActive(job.state)) return job;

  const { completedAt: _completedAt, canceledAt: _canceledAt, ...stable } = job;
  return snapshot({
    ...stable,
    state: "failed",
    updatedAt: timestamp,
    outputs: [],
    error: {
      name: "InterruptedJobError",
      message: "Job was interrupted before it could be restored.",
      at: timestamp
    }
  });
}

function isRestoredActive(state: JobState) {
  return state === "analyzing" || state === "running" || state === "paused" || state === "canceling" || state === "validating";
}

function cloneResult(result: EngineResult): EngineResult {
  return result.map((output) => Object.freeze({ name: output.name, blob: output.blob }) as unknown as EngineResult[number]);
}

function freezeResult(result: EngineResult): EngineResult {
  return Object.freeze(result.map((output) => Object.freeze({ name: output.name, blob: output.blob }))) as unknown as EngineResult;
}

function isCurrent(record: JobRecord, attempt: number) {
  return record.job.attempt === attempt;
}

function isCurrentState(record: JobRecord, attempt: number, state: JobState) {
  return isCurrent(record, attempt) && record.job.state === state;
}

function isTerminal(state: JobState) {
  return state === "canceled" || state === "failed" || state === "complete";
}

function errorFacts(error: unknown, at: string): JobError {
  if (error && typeof error === "object") {
    const candidate = error as { name?: unknown; message?: unknown; validation?: unknown };
    return {
      name: typeof candidate.name === "string" ? candidate.name : "Error",
      message: typeof candidate.message === "string" ? candidate.message : String(error),
      at,
      ...(isOutputValidationList(candidate.validation) ? { validation: copy(candidate.validation) } : {})
    };
  }
  return { name: "Error", message: String(error), at };
}

function assertValidationMatchesResult(validation: readonly OutputValidation[], result: EngineResult) {
  if (validation.length !== result.length) {
    throw new Error("Output validator returned an unexpected number of validation facts.");
  }
  for (let index = 0; index < result.length; index += 1) {
    const output = result[index];
    const fact = validation[index];
    if (fact.name !== output.name || fact.size !== output.blob.size || fact.mime !== output.blob.type) {
      throw new Error("Output validator returned facts that do not match the conversion output.");
    }
  }
}

function outputValidationError(validation: readonly OutputValidation[]) {
  const details = validation.flatMap((fact) => fact.errors).join(" ");
  return Object.assign(new Error(`Output validation failed.${details ? ` ${details}` : ""}`), {
    name: "OutputValidationError",
    validation
  });
}

function assertValidationMatchesPersistedFacts(validation: readonly OutputValidation[], outputs: readonly JobOutput[]) {
  for (let index = 0; index < outputs.length; index += 1) {
    const persisted = outputs[index].validation;
    if (!persisted) continue;
    const current = validation[index];
    if (
      current.name !== persisted.name ||
      current.expectedFormat !== persisted.expectedFormat ||
      current.detectedFormat !== persisted.detectedFormat ||
      current.mime !== persisted.mime ||
      current.size !== persisted.size ||
      current.valid !== persisted.valid
    ) {
      throw new Error("Output validation facts do not match serialized output metadata.");
    }
  }
}

function isOutputValidationList(value: unknown): value is OutputValidation[] {
  return Array.isArray(value) && value.every((fact) => fact && typeof fact === "object" && typeof (fact as OutputValidation).name === "string" && typeof (fact as OutputValidation).valid === "boolean");
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function snapshot<T>(value: T): T {
  return deepFreeze(copy(value));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const property of Object.values(value as Record<string, unknown>)) {
      deepFreeze(property);
    }
  }
  return value;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function defaultJobId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "job-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}
