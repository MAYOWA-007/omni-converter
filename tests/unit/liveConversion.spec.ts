import { readFile } from "node:fs/promises";
import { expect, test } from "playwright/test";
import { executeConversionJob } from "../../src/App";
import { createJobController } from "../../src/core/jobs";
import type { ConversionEngine } from "../../src/engines/types";
import type { ConversionRecipe, FileInspection } from "../../src/lib/types";

function recipe(): ConversionRecipe {
  return {
    id: "live-test",
    input: ["image"],
    category: "test",
    output: "png",
    title: "PNG",
    description: "Live path test",
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
  return { name: "source.png", extension: "png", mime: "image/png", size: 1, family: "image", notes: [] };
}

function validPng() {
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
  return { name: "result.png", blob: new Blob([bytes], { type: "image/png" }) };
}

function engine(convert: ConversionEngine["convert"]): ConversionEngine {
  return { id: "live-engine", runtimes: ["browser"], cancellation: "none", ownsRecipe: () => true, convert };
}

function input() {
  return {
    file: new File(["x"], "source.png", { type: "image/png" }),
    inspection: inspection(),
    recipe: recipe(),
    settings: {}
  };
}

test("runs conversion through a real job controller and retains only validated output", async () => {
  const produced = validPng();
  const outcome = await executeConversionJob(input(), () => createJobController(() => engine(async () => [produced]), { createId: () => "live-job" }));

  expect(outcome).toMatchObject({
    status: "complete",
    job: { id: "live-job", state: "complete", outputs: [{ validation: { valid: true, detectedFormat: "png" } }] },
    outputs: [{ name: "result.png" }]
  });
  if (outcome.status === "complete") expect(outcome.outputs[0].blob).toBe(produced.blob);
});

test("returns a serializable failed outcome and no outputs for an empty engine result", async () => {
  const outcome = await executeConversionJob(input(), () => createJobController(() => engine(async () => []), { createId: () => "live-job" }));

  expect(outcome).toMatchObject({
    status: "failed",
    job: { state: "failed" },
    error: { name: "OutputValidationError", message: "Output validation failed. Conversion produced no outputs." }
  });
  expect("outputs" in outcome).toBe(false);
  expect(() => JSON.stringify(outcome.error)).not.toThrow();
});

test("workflow path has no direct converter bypass and exposes explicit result saves", async () => {
  const source = await readFile(new URL("../../src/App.tsx", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../../src/hooks/useOmniWorkflow.ts", import.meta.url), "utf8");
  const results = await readFile(new URL("../../src/components/ResultScreen.tsx", import.meta.url), "utf8");

  expect(source).not.toContain("convertRecipe(");
  expect(workflow).toContain("createJobController");
  expect(workflow).toContain("controller.getResult");
  expect(results).toContain("saveOutput(");
  expect(results).toContain("saveOutputBundle(");
  expect(results).toContain("Save bundle");
});
