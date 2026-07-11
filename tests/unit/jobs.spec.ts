import { expect, test } from "playwright/test";
import { createJobController } from "../../src/core/jobs";
import type { ConversionEngine, EngineResult } from "../../src/engines/types";
import type { ConversionRecipe, FileInspection } from "../../src/lib/types";

function recipe(id = "test-job"): ConversionRecipe {
  return {
    id,
    input: ["image"],
    category: "test",
    output: "png",
    title: "PNG",
    description: "Test conversion",
    treatments: [],
    editorControls: [],
    requiredCapabilities: [],
    intensity: "light",
    engine: "test",
    implementation: "ready",
    maturity: "verified",
    runtimes: ["browser"],
    localOnly: true
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

function input(overrides: Record<string, unknown> = {}) {
  return {
    file: new File([new Uint8Array([1, 2, 3, 4])], "source.png", { type: "image/png", lastModified: 42 }),
    inspection: inspection(),
    recipe: recipe(),
    settings: { compression: "balanced" },
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function engine(convert: ConversionEngine["convert"], cancellation: ConversionEngine["cancellation"] = "none"): ConversionEngine {
  return {
    id: "test-engine",
    runtimes: ["browser"],
    cancellation,
    ownsRecipe: () => true,
    convert
  };
}

function validPngOutput(name = "result.png") {
  const bytes = new Uint8Array(45);
  const view = new DataView(bytes.buffer);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  view.setUint32(8, 13);
  bytes.set(new TextEncoder().encode("IHDR"), 12);
  view.setUint32(16, 1);
  view.setUint32(20, 1);
  bytes.set([8, 2, 0, 0, 0], 24);
  bytes.set(new TextEncoder().encode("IEND"), 37);
  bytes.set([0xae, 0x42, 0x60, 0x82], 41);
  return {
    name,
    blob: new Blob([bytes], { type: "image/png" })
  };
}

test("creates serializable immutable snapshots without runtime file or output data", () => {
  const controller = createJobController(() => engine(async () => []), { createId: () => "job-1", now: () => "2026-07-09T00:00:00.000Z" });
  const job = controller.create(input({ settings: { trim: "Custom range", trimStart: 0.5, trimEnd: 1.25 } }));

  expect(job).toMatchObject({
    id: "job-1",
    attempt: 1,
    state: "queued",
    input: { name: "source.png", type: "image/png", size: 4, lastModified: 42 },
    progress: { value: 0, phase: "queued" },
    settings: { trim: "Custom range", trimStart: 0.5, trimEnd: 1.25 },
    outputs: []
  });
  expect(job.error).toBeUndefined();
  expect(JSON.stringify(job)).not.toContain("File");
  expect(JSON.stringify(job)).not.toContain("Blob");
  expect(Object.isFrozen(job)).toBe(true);
  expect(Object.isFrozen(job.progress)).toBe(true);
  expect(Object.isFrozen(job.outputs)).toBe(true);
});

test("moves through legal execution states and maps engine progress into a weighted monotonic value", async () => {
  const work = deferred<EngineResult>();
  const events: string[] = [];
  let reportProgress!: (progress: { completed?: number; total?: number; label?: string }) => void;
  const controller = createJobController(
    () => engine(async (context) => {
      reportProgress = context.reportProgress;
      return work.promise;
    }),
    { createId: () => "job-1", now: () => "2026-07-09T00:00:00.000Z" }
  );
  controller.subscribe((event) => events.push(event.job.state));
  const job = controller.create(input());

  const completion = controller.start(job.id);
  await expect.poll(() => controller.get(job.id)?.state).toBe("running");
  expect(controller.get(job.id)?.progress.value).toBe(10);

  reportProgress({ completed: 1, total: 4, label: "Converting" });
  const running = controller.get(job.id);
  expect(running?.progress).toEqual({ value: 30, phase: "conversion", label: "Converting" });

  reportProgress({ completed: 99, total: 4 });
  expect(controller.get(job.id)?.progress.value).toBe(90);

  work.resolve([validPngOutput()]);
  await completion;

  expect(events).toEqual(["queued", "analyzing", "running", "running", "running", "validating", "complete"]);
  expect(controller.get(job.id)?.progress).toEqual({ value: 100, phase: "complete" });
  await expect(controller.start(job.id)).rejects.toThrow('cannot start from state "complete"');
});

test("does not claim cancellation for an engine that cannot be canceled", async () => {
  const work = deferred<EngineResult>();
  let signal!: AbortSignal;
  const controller = createJobController(() => engine(async (context) => {
    signal = context.signal;
    return work.promise;
  }), { createId: () => "job-1" });
  const job = controller.create(input());
  const completion = controller.start(job.id);

  await expect.poll(() => controller.get(job.id)?.state).toBe("running");
  expect(controller.cancel(job.id)).toBe(false);
  expect(controller.get(job.id)?.state).toBe("running");
  expect(signal.aborted).toBe(false);

  work.resolve([validPngOutput()]);
  await completion;
  expect(controller.get(job.id)?.state).toBe("complete");
});

test("cancels a cooperative engine and ignores its late completion", async () => {
  const work = deferred<[{ name: string; blob: Blob }]>();
  let signal!: AbortSignal;
  const controller = createJobController(() => engine(async (context) => {
    signal = context.signal;
    return work.promise;
  }, "cooperative"), { createId: () => "job-1" });
  const job = controller.create(input());
  const completion = controller.start(job.id);

  await expect.poll(() => controller.get(job.id)?.state).toBe("running");
  expect(controller.cancel(job.id)).toBe(true);
  expect(signal.aborted).toBe(true);
  expect(controller.get(job.id)?.state).toBe("canceling");

  work.resolve([{ name: "late.png", blob: new Blob(["late"]) }]);
  await completion;
  expect(controller.get(job.id)).toMatchObject({ state: "canceled", outputs: [] });
  expect(controller.getResult(job.id)).toBeUndefined();
});

test("records serializable failures and retries as a fresh attempt", async () => {
  const second = deferred<[{ name: string; blob: Blob }]>();
  const signals: AbortSignal[] = [];
  let calls = 0;
  const controller = createJobController(
    () => engine(async (context) => {
      signals.push(context.signal);
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("decoder failed"), { name: "DecoderError" });
      return second.promise;
    }, "cooperative"),
    { createId: () => "job-1", now: () => "2026-07-09T00:00:00.000Z" }
  );
  const job = controller.create(input());
  await controller.start(job.id);

  expect(controller.get(job.id)).toMatchObject({
    attempt: 1,
    state: "failed",
    error: { name: "DecoderError", message: "decoder failed", at: "2026-07-09T00:00:00.000Z" }
  });
  expect(JSON.stringify(controller.get(job.id))).not.toContain("\"stack\"");

  const retry = controller.retry(job.id);
  await expect.poll(() => controller.get(job.id)?.attempt).toBe(2);
  await expect.poll(() => controller.get(job.id)?.state).toBe("running");
  expect(controller.get(job.id)).toMatchObject({ state: "running", outputs: [] });
  expect(controller.get(job.id)?.error).toBeUndefined();
  expect(signals[0]).not.toBe(signals[1]);

  second.resolve([validPngOutput("fresh.png")]);
  await retry;
  expect(controller.get(job.id)).toMatchObject({ attempt: 2, state: "complete", outputs: [{ name: "fresh.png", type: "image/png", size: 45 }] });
  expect(controller.getResult(job.id)?.[0].name).toBe("fresh.png");
});

test("retries a canceled job only after the canceled attempt settles", async () => {
  const first = deferred<[{ name: string; blob: Blob }]>();
  const second = deferred<[{ name: string; blob: Blob }]>();
  let calls = 0;
  const controller = createJobController(
    () => engine(async () => {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    }, "cooperative"),
    { createId: () => "job-1" }
  );
  const job = controller.create(input());
  const firstCompletion = controller.start(job.id);
  await expect.poll(() => controller.get(job.id)?.state).toBe("running");
  expect(controller.cancel(job.id)).toBe(true);
  expect(controller.get(job.id)?.state).toBe("canceling");
  first.resolve([{ name: "discarded.png", blob: new Blob(["stale"]) }]);
  await firstCompletion;
  expect(controller.get(job.id)?.state).toBe("canceled");

  const retry = controller.retry(job.id);
  await expect.poll(() => controller.get(job.id)?.attempt).toBe(2);
  await expect.poll(() => controller.get(job.id)?.state).toBe("running");

  second.resolve([validPngOutput("fresh.png")]);
  await retry;
  expect(controller.get(job.id)).toMatchObject({ attempt: 2, state: "complete", outputs: [{ name: "fresh.png", type: "image/png", size: 45 }] });
});

test("emits immutable event snapshots that stay unchanged after later updates", async () => {
  const work = deferred<EngineResult>();
  const snapshots: unknown[] = [];
  const controller = createJobController(() => engine(async () => work.promise), { createId: () => "job-1" });
  controller.subscribe((event) => snapshots.push(event.job));
  const job = controller.create(input());
  const completion = controller.start(job.id);

  await expect.poll(() => controller.get(job.id)?.state).toBe("running");
  const queued = snapshots[0] as { state: string };
  expect(queued.state).toBe("queued");
  expect(Object.isFrozen(queued)).toBe(true);

  work.resolve([validPngOutput()]);
  await completion;
  expect(queued.state).toBe("queued");
  expect((snapshots.at(-1) as { state: string }).state).toBe("complete");
});

test("does not invoke an engine when a running listener cancels before conversion starts", async () => {
  let calls = 0;
  const controller = createJobController(() => engine(async () => {
    calls += 1;
    return [];
  }, "cooperative"), { createId: () => "job-1" });
  controller.subscribe((event) => {
    if (event.job.state === "running") controller.cancel(event.job.id);
  });
  const job = controller.create(input());

  await controller.start(job.id);

  expect(calls).toBe(0);
  expect(controller.get(job.id)?.state).toBe("canceled");
});

test("isolates throwing listeners during create, start, and progress events", async () => {
  const work = deferred<EngineResult>();
  const received: string[] = [];
  const listenerErrors: string[] = [];
  let reportProgress!: (progress: { completed?: number; total?: number }) => void;
  const controller = createJobController(
    () => engine(async (context) => {
      reportProgress = context.reportProgress;
      return work.promise;
    }),
    {
      createId: () => "job-1",
      onListenerError: (_error, event) => listenerErrors.push(event.job.state)
    }
  );
  controller.subscribe(() => {
    throw new Error("listener failure");
  });
  controller.subscribe((event) => received.push(event.job.state));
  const job = controller.create(input());
  const completion = controller.start(job.id);

  await expect.poll(() => controller.get(job.id)?.state).toBe("running");
  reportProgress({ completed: 1, total: 2 });
  expect(controller.get(job.id)?.state).toBe("running");
  expect(received).toEqual(["queued", "analyzing", "running", "running"]);
  expect(listenerErrors).toEqual(["queued", "analyzing", "running", "running"]);

  work.resolve([validPngOutput()]);
  await completion;
  expect(controller.get(job.id)?.state).toBe("complete");
});

test("retries with a cached engine without reanalyzing unchanged input", async () => {
  const second = deferred<EngineResult>();
  const states: string[] = [];
  let resolverCalls = 0;
  let calls = 0;
  const adapter = engine(async () => {
    calls += 1;
    if (calls === 1) throw new Error("first attempt failed");
    return second.promise;
  }, "cooperative");
  const controller = createJobController(() => {
    resolverCalls += 1;
    return adapter;
  }, {
    createId: () => "job-1",
    now: (() => {
      let tick = 0;
      return () => new Date(Date.UTC(2026, 6, 9, 0, 0, tick++)).toISOString();
    })()
  });
  controller.subscribe((event) => states.push(event.job.state));
  const job = controller.create(input());
  await controller.start(job.id);
  const firstStartedAt = controller.get(job.id)?.startedAt;
  states.length = 0;

  const retry = controller.retry(job.id);
  await expect.poll(() => controller.get(job.id)?.state).toBe("running");
  expect(states).toEqual(["queued", "running"]);
  expect(resolverCalls).toBe(1);
  expect(controller.get(job.id)?.startedAt).toBeDefined();
  expect(controller.get(job.id)?.startedAt).not.toBe(firstStartedAt);

  second.resolve([validPngOutput()]);
  await retry;
});

test("returns frozen cloned output records from getResult", async () => {
  const controller = createJobController(() => engine(async () => [validPngOutput("original.png")]), { createId: () => "job-1" });
  const job = controller.create(input());
  await controller.start(job.id);

  const result = controller.getResult(job.id);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result?.[0])).toBe(true);
  expect(() => {
    if (result) result[0].name = "mutated.png";
  }).toThrow();
  expect(controller.getResult(job.id)?.[0].name).toBe("original.png");
});

test("exports, restores, and hydrates completed result resources after a JSON roundtrip", async () => {
  const source = createJobController(() => engine(async () => [validPngOutput("converted.png")]), { createId: () => "job-1" });
  const job = source.create({ ...input(), source: { id: "source-resource" } });
  await source.start(job.id);
  const serialized = JSON.parse(JSON.stringify(source.exportSnapshots()));
  const restored = createJobController(() => engine(async () => []));

  restored.restore(serialized);

  expect(restored.list()).toEqual([expect.objectContaining({
    id: "job-1",
    state: "complete",
    source: { id: "source-resource" },
    outputs: [expect.objectContaining({ name: "converted.png", type: "image/png", size: 45, resource: { id: "job-1:1:output:0" } })]
  })]);
  expect(restored.getResult(job.id)).toBeUndefined();

  await restored.hydrate(job.id, {
    source: { resource: { id: "source-resource" }, file: input().file },
    outputs: [{
      resource: { id: "job-1:1:output:0" },
      output: validPngOutput("converted.png")
    }]
  });
  expect(restored.getResult(job.id)?.[0].name).toBe("converted.png");
});

test("rejects restored resources that do not exactly match serialized bindings", async () => {
  const source = createJobController(() => engine(async () => [validPngOutput("converted.png")]), { createId: () => "job-1" });
  const job = source.create({ ...input(), source: { id: "source-resource" } });
  await source.start(job.id);
  const restored = createJobController(() => engine(async () => []));
  restored.restore(JSON.parse(JSON.stringify(source.exportSnapshots())));
  const correctOutput = validPngOutput("converted.png");

  await expect(restored.hydrate(job.id, {
    source: { resource: { id: "source-resource" }, file: new File(["result"], "wrong.png", { type: "image/png", lastModified: 42 }) }
  })).rejects.toThrow("does not match serialized input facts");
  await expect(restored.hydrate(job.id, {
    source: { resource: { id: "wrong-source" }, file: input().file }
  })).rejects.toThrow("does not match serialized source resource");
  await expect(restored.hydrate(job.id, {
    outputs: [{ resource: { id: "wrong-output" }, output: correctOutput }]
  })).rejects.toThrow("does not match serialized output resource");
  await expect(restored.hydrate(job.id, {
    outputs: [{ resource: { id: "job-1:1:output:0" }, output: { name: "wrong.png", blob: correctOutput.blob } }]
  })).rejects.toThrow("does not match serialized output metadata");
  await expect(restored.hydrate(job.id, {
    outputs: [{ resource: { id: "job-1:1:output:0" }, output: { name: "converted.png", blob: correctOutput.blob.slice(0, undefined, "text/plain") } }]
  })).rejects.toThrow("does not match serialized output metadata");
  await expect(restored.hydrate(job.id, {
    outputs: [{ resource: { id: "job-1:1:output:0" }, output: { name: "converted.png", blob: new Blob(["wrong!!"], { type: "image/png" }) } }]
  })).rejects.toThrow("does not match serialized output metadata");
  await expect(restored.hydrate(job.id, {
    outputs: []
  })).rejects.toThrow("Output binding count");
  await expect(restored.hydrate(job.id, {
    outputs: [
      { resource: { id: "job-1:1:output:0" }, output: correctOutput },
      { resource: { id: "job-1:1:output:0" }, output: correctOutput }
    ]
  })).rejects.toThrow("Output binding count");

  await restored.hydrate(job.id, {
    source: { resource: { id: "source-resource" }, file: input().file },
    outputs: [{ resource: { id: "job-1:1:output:0" }, output: correctOutput }]
  });
  expect(restored.getResult(job.id)?.[0].name).toBe("converted.png");
});

test("rejects malformed snapshots with duplicate persisted output resources and unused bindings", async () => {
  const source = createJobController(() => engine(async () => [
    validPngOutput("same.png"),
    validPngOutput("same.png")
  ]), { createId: () => "job-1" });
  const job = source.create(input());
  await source.start(job.id);
  const serialized = JSON.parse(JSON.stringify(source.exportSnapshots()));
  serialized[0].outputs[1].resource.id = serialized[0].outputs[0].resource.id;
  const restored = createJobController(() => engine(async () => []));
  restored.restore(serialized);
  const output = validPngOutput("same.png");

  await expect(restored.hydrate(job.id, {
    outputs: [
      { resource: { id: "job-1:1:output:0" }, output },
      { resource: { id: "job-1:1:output:1" }, output }
    ]
  })).rejects.toThrow("Duplicate persisted output resource");
});

test("normalizes restored active jobs and retries a hydrated restored canceled job", async () => {
  const activeWork = deferred<[]>();
  const activeSource = createJobController(() => engine(async () => activeWork.promise), { createId: () => "active" });
  const activeJob = activeSource.create(input());
  void activeSource.start(activeJob.id);
  await expect.poll(() => activeSource.get(activeJob.id)?.state).toBe("running");
  const activeRestore = createJobController(() => engine(async () => []), { now: () => "2026-07-09T00:00:00.000Z" });
  activeRestore.restore(JSON.parse(JSON.stringify(activeSource.exportSnapshots())));
  expect(activeRestore.get(activeJob.id)).toMatchObject({
    state: "failed",
    error: { name: "InterruptedJobError", message: "Job was interrupted before it could be restored." }
  });

  const canceledSource = createJobController(
    () => engine(async (context) => new Promise<[]>((_resolve, reject) => context.signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")))), "cooperative"),
    { createId: () => "canceled" }
  );
  const canceledJob = canceledSource.create(input());
  const cancellation = canceledSource.start(canceledJob.id);
  await expect.poll(() => canceledSource.get(canceledJob.id)?.state).toBe("running");
  canceledSource.cancel(canceledJob.id);
  await cancellation;
  expect(canceledSource.get(canceledJob.id)?.state).toBe("canceled");

  let resolverCalls = 0;
  const restored = createJobController(() => {
    resolverCalls += 1;
    return engine(async () => [validPngOutput()]);
  });
  restored.restore(JSON.parse(JSON.stringify(canceledSource.exportSnapshots())));
  await expect(restored.retry(canceledJob.id)).rejects.toThrow("has no hydrated source file");
  await restored.hydrate(canceledJob.id, {
    source: { resource: canceledSource.get(canceledJob.id)?.source ?? { id: "" }, file: input().file }
  });
  await restored.retry(canceledJob.id);
  expect(resolverCalls).toBe(1);
  expect(restored.get(canceledJob.id)?.state).toBe("complete");
});

test("awaits injected output validation before completing and records validation facts", async () => {
  const validation = deferred<Array<{
    name: string;
    expectedFormat: string;
    detectedFormat: string;
    mime: string;
    size: number;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>>();
  const controller = createJobController(
    () => engine(async () => [validPngOutput()]),
    {
      createId: () => "job-1",
      validateOutputs: () => validation.promise
    } as never
  );
  const job = controller.create(input());
  const completion = controller.start(job.id);

  await expect.poll(() => controller.get(job.id)?.state).toBe("validating");
  expect(controller.getResult(job.id)).toBeUndefined();
  validation.resolve([{
    name: "result.png",
    expectedFormat: "png",
    detectedFormat: "png",
    mime: "image/png",
    size: 45,
    valid: true,
    errors: [],
    warnings: []
  }]);
  await completion;

  expect(controller.get(job.id)).toMatchObject({
    state: "complete",
    outputs: [{ name: "result.png", validation: { expectedFormat: "png", detectedFormat: "png", valid: true } }]
  });
  expect(controller.getResult(job.id)?.[0].name).toBe("result.png");
});

test("fails validation for corrupt output without exposing a result", async () => {
  const controller = createJobController(() => engine(async () => [{
    name: "broken.pdf",
    blob: new Blob(["%PDF-1.7 missing EOF"], { type: "application/pdf" })
  }]), { createId: () => "job-1" });
  const job = controller.create(input());

  await controller.start(job.id);

  expect(controller.get(job.id)).toMatchObject({
    state: "failed",
    progress: { value: 99, phase: "validation" },
    error: { name: "OutputValidationError" }
  });
  expect(controller.get(job.id)?.error?.message).toContain("PDF EOF marker is missing");
  expect(controller.getResult(job.id)).toBeUndefined();
});

test("fails validation when an engine produces no outputs", async () => {
  const controller = createJobController(() => engine(async () => []), { createId: () => "job-1" });
  const job = controller.create(input());

  await controller.start(job.id);

  expect(controller.get(job.id)).toMatchObject({
    state: "failed",
    error: { name: "OutputValidationError", message: "Output validation failed. Conversion produced no outputs." },
    outputs: []
  });
  expect(controller.getResult(job.id)).toBeUndefined();
});

test("revalidates restored output hydration and rejects same-metadata corrupt replacement bytes", async () => {
  const source = createJobController(() => engine(async () => [validPngOutput("converted.png")]), { createId: () => "job-1" });
  const job = source.create(input());
  await source.start(job.id);
  const restored = createJobController(() => engine(async () => []));
  restored.restore(JSON.parse(JSON.stringify(source.exportSnapshots())));
  const valid = validPngOutput("converted.png");
  const corruptBytes = new Uint8Array(await valid.blob.arrayBuffer());
  corruptBytes[19] = 0;
  const corrupt = { name: valid.name, blob: new Blob([corruptBytes], { type: valid.blob.type }) };

  await expect(Promise.resolve(restored.hydrate(job.id, {
    outputs: [{ resource: { id: "job-1:1:output:0" }, output: corrupt }]
  }))).rejects.toThrow(/validation/i);
  expect(restored.getResult(job.id)).toBeUndefined();

  await expect(Promise.resolve(restored.hydrate(job.id, {
    outputs: [{ resource: { id: "job-1:1:output:0" }, output: valid }]
  }))).resolves.toMatchObject({ state: "complete" });
  expect(restored.getResult(job.id)?.[0].name).toBe("converted.png");
});
