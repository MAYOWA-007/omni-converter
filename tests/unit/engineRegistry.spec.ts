import { expect, test } from "playwright/test";
import { canRunRecipe, convertRecipe } from "../../src/lib/conversions";
import { createLegacyAdapter, legacyEngines } from "../../src/engines/legacyAdapter";
import { engineCanCancel, engineForRecipe, registerEngine } from "../../src/engines/registry";
import type { ConversionEngine, EngineContext, LegacyExecutionContext } from "../../src/engines/types";
import type { ConversionRecipe, FileInspection } from "../../src/lib/types";

function recipe(id: string, implementation: ConversionRecipe["implementation"] = "ready", overrides: Partial<ConversionRecipe> = {}): ConversionRecipe {
  return {
    id,
    input: ["image"],
    category: "test",
    output: "test",
    title: "Test output",
    description: "Test output",
    treatments: [],
    editorControls: [],
    requiredCapabilities: [],
    intensity: "light",
    engine: "test",
    implementation,
    maturity: "verified",
    runtimes: ["browser"],
    localOnly: true,
    ...overrides
  };
}

function inspection(): FileInspection {
  return {
    name: "source.png",
    extension: "png",
    mime: "image/png",
    size: 4,
    family: "image",
    notes: []
  };
}

function file() {
  return new File([new Uint8Array([1, 2, 3, 4])], "source.png", { type: "image/png" });
}

function fakeEngine(id: string, recipeId: string, convert: ConversionEngine["convert"] = async () => [], cancellation: ConversionEngine["cancellation"] = "none"): ConversionEngine {
  return {
    id,
    runtimes: ["browser"],
    cancellation,
    ownsRecipe: (candidate) => candidate.id === recipeId,
    convert
  };
}

test("routes a ready recipe to its unique engine with the optional execution context", async () => {
  const candidate = recipe("test-unique-engine");
  const controller = new AbortController();
  const progress: unknown[] = [];
  let received: EngineContext | undefined;
  const remove = registerEngine(fakeEngine("test-unique-engine", candidate.id, async (context) => {
    received = context;
    context.reportProgress({ completed: 1, total: 1, label: "Complete" });
    return [];
  }));

  try {
    expect(engineForRecipe(candidate).id).toBe("test-unique-engine");
    await expect(convertRecipe(file(), inspection(), candidate, {}, { signal: controller.signal, reportProgress: (update) => progress.push(update) })).resolves.toEqual([]);
    expect(received).toMatchObject({ file: expect.any(File), inspection: inspection(), recipe: candidate, settings: {} });
    expect(received?.signal).toBe(controller.signal);
    expect(progress).toEqual([{ completed: 1, total: 1, label: "Complete" }]);
    expect(canRunRecipe(candidate)).toBe(true);
  } finally {
    remove();
  }
});

test("rejects a recipe with no owning engine and reports it as unavailable", () => {
  const candidate = recipe("test-missing-engine");

  expect(() => engineForRecipe(candidate)).toThrow('No conversion engine owns recipe "test-missing-engine".');
  expect(canRunRecipe(candidate)).toBe(false);
});

test("rejects a recipe claimed by more than one engine", () => {
  const candidate = recipe("test-ambiguous-engine");
  const removeFirst = registerEngine(fakeEngine("test-ambiguous-first", candidate.id));
  const removeSecond = registerEngine(fakeEngine("test-ambiguous-second", candidate.id));

  try {
    expect(() => engineForRecipe(candidate)).toThrow('Multiple conversion engines own recipe "test-ambiguous-engine": test-ambiguous-first, test-ambiguous-second.');
    expect(canRunRecipe(candidate)).toBe(false);
  } finally {
    removeSecond();
    removeFirst();
  }
});

test("does not report planned recipes as runnable even when an engine owns them", () => {
  const candidate = recipe("test-planned-engine", "planned");
  const remove = registerEngine(fakeEngine("test-planned-engine", candidate.id));

  try {
    expect(canRunRecipe(candidate)).toBe(false);
  } finally {
    remove();
  }
});

test("does not report an unselectable legacy-owned recipe as runnable", () => {
  const candidate = recipe("image-to-png", "ready", { maturity: "implemented", runtimes: [] });

  expect(canRunRecipe(candidate)).toBe(false);
  expect(() => engineForRecipe(candidate)).toThrow('Recipe "image-to-png" is not available in runtime "browser".');
});

test("legacy adapter preserves converter output names and bytes", async () => {
  const candidate = recipe("test-legacy-output");
  const output = { name: "unchanged.bin", blob: new Blob([new Uint8Array([7, 8, 9])], { type: "application/octet-stream" }) };
  const engine = createLegacyAdapter({
    id: "test-legacy-output",
    runtimes: ["browser"],
    cancellation: "none",
    ownsRecipe: (value) => value.id === candidate.id,
    convert: async () => [output]
  });

  const result = await engine.convert({
    file: file(),
    inspection: inspection(),
    recipe: candidate,
    settings: {},
    signal: new AbortController().signal,
    reportProgress: () => {}
  });

  expect(result[0].name).toBe("unchanged.bin");
  expect([...new Uint8Array(await result[0].blob.arrayBuffer())]).toEqual([7, 8, 9]);
});

test("legacy adapter stops before a conversion begins when its signal is already aborted", async () => {
  const candidate = recipe("test-legacy-before-abort");
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  const engine = createLegacyAdapter({
    id: "test-legacy-before-abort",
    runtimes: ["browser"],
    cancellation: "none",
    ownsRecipe: (value) => value.id === candidate.id,
    convert: async () => {
      calls += 1;
      return [];
    }
  });

  await expect(engine.convert({ file: file(), inspection: inspection(), recipe: candidate, settings: {}, signal: controller.signal, reportProgress: () => {} })).rejects.toMatchObject({ name: "AbortError" });
  expect(calls).toBe(0);
});

test("legacy adapter stops after an awaited conversion when its signal is aborted", async () => {
  const candidate = recipe("test-legacy-after-abort");
  const controller = new AbortController();
  const engine = createLegacyAdapter({
    id: "test-legacy-after-abort",
    runtimes: ["browser"],
    cancellation: "none",
    ownsRecipe: (value) => value.id === candidate.id,
    convert: async () => {
      controller.abort();
      return [{ name: "discarded.bin", blob: new Blob(["discarded"]) }];
    }
  });

  await expect(engine.convert({ file: file(), inspection: inspection(), recipe: candidate, settings: {}, signal: controller.signal, reportProgress: () => {} })).rejects.toMatchObject({ name: "AbortError" });
});

test("legacy adapter passes the exact execution context to converters and exposes in-flight aborts", async () => {
  const candidate = recipe("test-legacy-context");
  const controller = new AbortController();
  const progress: unknown[] = [];
  let received: LegacyExecutionContext | undefined;
  let observedAbort = false;
  let started!: () => void;
  let release!: () => void;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  const releasePromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  const engine = createLegacyAdapter({
    id: "test-legacy-context",
    runtimes: ["browser"],
    cancellation: "none",
    ownsRecipe: (value) => value.id === candidate.id,
    convert: async (_file, _inspection, _recipe, _settings, execution) => {
      received = execution;
      started();
      await releasePromise;
      observedAbort = execution?.signal.aborted === true;
      execution?.reportProgress({ completed: 1, total: 1, label: "Finished legacy work" });
      return [];
    }
  });
  const context: EngineContext = {
    file: file(),
    inspection: inspection(),
    recipe: candidate,
    settings: {},
    signal: controller.signal,
    reportProgress: (update) => progress.push(update)
  };

  const conversion = engine.convert(context);
  await startedPromise;
  controller.abort();
  release();

  await expect(conversion).rejects.toMatchObject({ name: "AbortError" });
  expect(received).toBe(context);
  expect(observedAbort).toBe(true);
  expect(progress).toEqual([{ completed: 1, total: 1, label: "Finished legacy work" }]);
});

test("only engines with a cooperative or hard cancellation capability are advertised as cancellable", () => {
  const cooperative = fakeEngine("test-cooperative-engine", "test-cooperative-engine", async () => [], "cooperative");

  expect(legacyEngines.map((engine) => engine.cancellation)).toEqual(["none", "none", "cooperative", "none"]);
  expect(engineCanCancel(legacyEngines.find((engine) => engine.id === "browser-media")!)).toBe(true);
  expect(legacyEngines.filter((engine) => engine.id !== "browser-media").every((engine) => !engineCanCancel(engine))).toBe(true);
  expect(engineCanCancel(cooperative)).toBe(true);
});

test("does not advertise an engine with a missing cancellation capability as cancellable", () => {
  const malformed = { ...fakeEngine("test-malformed-engine", "test-malformed-engine"), cancellation: undefined } as unknown as ConversionEngine;

  expect(engineCanCancel(malformed)).toBe(false);
});
