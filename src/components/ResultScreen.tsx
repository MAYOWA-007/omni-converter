import { ChevronLeft, Download, FileCheck2, FolderOutput, Package, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveOutput, saveOutputBundle, saveOutputsToFolder } from "../core/export";
import type { ConversionJob, JobError } from "../core/jobs";
import type { EngineResult } from "../engines/types";
import { formatBytes } from "../lib/formatting";
import { OutputPreview } from "./OutputPreview";

interface ResultScreenProps {
  job: ConversionJob | null;
  outputs: EngineResult;
  error: JobError | null;
  onRetry: () => void;
  onBack: () => void;
  onConvertAnotherWay: () => void;
  onStartOver: () => void;
}

export function ResultScreen({ job, outputs, error, onRetry, onBack, onConvertAnotherWay, onStartOver }: ResultScreenProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(outputs.map((_, index) => index)));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const state = job?.state ?? "failed";
  const sourceSize = job?.input.size ?? 0;
  const totalOutputSize = useMemo(() => outputs.reduce((total, output) => total + output.blob.size, 0), [outputs]);
  const folderSupported = typeof window !== "undefined" && typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelected(new Set(outputs.map((_, index) => index)));
    setMessage(null);
  }, [outputs]);

  const selectedOutputs = outputs.filter((_, index) => selected.has(index));

  async function saveOne(output: EngineResult[number]) {
    try {
      const result = await saveOutput(output);
      setMessage(result.status === "saved" ? `${result.name} saved.` : "Save canceled.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "This result could not be saved.");
    }
  }

  async function saveSelected() {
    if (selectedOutputs.length === 0) return;
    if (selectedOutputs.length === 1) {
      await saveOne(selectedOutputs[0]);
      return;
    }
    try {
      const result = await saveOutputBundle(selectedOutputs, { name: "omni-converter-selected.zip" });
      setMessage(result.status === "saved" ? `${result.name} saved.` : "Save canceled.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "The selected results could not be saved.");
    }
  }

  async function saveBundle() {
    try {
      const result = await saveOutputBundle(outputs, { name: "omni-converter-results.zip" });
      setMessage(result.status === "saved" ? `${result.name} saved.` : "Save canceled.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "The result bundle could not be saved.");
    }
  }

  async function saveFolder() {
    try {
      const result = await saveOutputsToFolder(selectedOutputs);
      if (result.status === "saved") setMessage(`${result.count} ${result.count === 1 ? "result" : "results"} saved.`);
      else if (result.status === "cancelled") setMessage("Save canceled.");
      else setMessage("Folder saving is not available in this browser.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "The selected results could not be saved to a folder.");
    }
  }

  if (state === "canceled") {
    return <section className="screen result-screen" aria-labelledby="result-title"><div className="result-layout result-message"><p className="screen-kicker">Canceled</p><h1 ref={headingRef} id="result-title" tabIndex={-1}>Conversion canceled</h1><p>The conversion was canceled before a result was created.</p><div className="result-actions"><button className="primary-action" type="button" onClick={onRetry}><RotateCcw size={16} />Retry</button><button className="ghost-action" type="button" onClick={onStartOver}>Start over</button></div></div></section>;
  }

  if (state === "failed") {
    const detail = error ?? job?.error;
    return <section className="screen result-screen" aria-labelledby="result-title"><div className="result-layout result-message"><p className="screen-kicker">Could not finish</p><h1 ref={headingRef} id="result-title" tabIndex={-1}>Conversion failed</h1>{detail ? <p className="result-error">{detail.name}: {detail.message}</p> : <p className="result-error">This conversion could not finish.</p>}<div className="result-actions"><button className="primary-action" type="button" onClick={onRetry}><RotateCcw size={16} />Retry</button><button className="ghost-action" type="button" onClick={onBack}><ChevronLeft size={16} />Back</button></div></div></section>;
  }

  return <section className="screen result-screen" aria-labelledby="result-title"><div className="result-layout"><div className="result-heading"><p className="screen-kicker">Complete</p><h1 ref={headingRef} id="result-title" tabIndex={-1}>Results</h1><p>{outputs.length === 1 ? "One validated output is ready." : `${outputs.length} validated outputs are ready.`}</p><p className="output-comparison">Source: {formatBytes(sourceSize)} / Total output: {formatBytes(totalOutputSize)} / {deltaLabel(totalOutputSize, sourceSize)}</p></div><div className="selection-actions"><button className="ghost-action" type="button" onClick={() => setSelected(new Set(outputs.map((_, index) => index)))}>Select all</button><button className="ghost-action" type="button" onClick={() => setSelected(new Set())}>Select none</button></div><div className="result-output-list" aria-label="Validated conversion results">{outputs.map((output, index) => {
    const facts = job?.outputs[index];
    const validation = facts?.validation;
    const checked = selected.has(index);
    return <article className="result-output" key={`${output.name}-${index}`}><div className="result-output-head"><div><h2>{output.name}</h2><p>{formatLabel(output.blob.type, output.name)} / {formatBytes(output.blob.size)} / {validation?.valid ? "Validated" : "Validation pending"}</p><p>Source: {formatBytes(sourceSize)} / Output: {formatBytes(output.blob.size)} / {deltaLabel(output.blob.size, sourceSize)}</p></div><div className="result-output-tools"><label className="output-select"><input aria-label={`Select ${output.name}`} type="checkbox" checked={checked} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} /><span>Select</span></label><button className="ghost-action" aria-label={`Save ${output.name}`} type="button" onClick={() => void saveOne(output)}><Download size={16} />Save</button></div></div><OutputPreview output={output} />{validation ? <p className="validation-facts"><FileCheck2 size={15} /> {validation.detectedFormat.toUpperCase()} / {validation.size} bytes</p> : null}</article>;
  })}</div>{message ? <p className="result-save-message" role="status">{message}</p> : null}<div className="result-actions"><button className="primary-action" disabled={selectedOutputs.length === 0} type="button" onClick={() => void saveSelected()}><Download size={16} />Save selected</button><button className="ghost-action" type="button" onClick={() => void saveBundle()}><Package size={16} />Save bundle</button>{folderSupported ? <button className="ghost-action" disabled={selectedOutputs.length === 0} type="button" onClick={() => void saveFolder()}><FolderOutput size={16} />Save folder</button> : null}<button className="ghost-action" type="button" onClick={onConvertAnotherWay}>Convert another way</button><button className="ghost-action" type="button" onClick={onStartOver}>Start over</button></div></div></section>;
}

function formatLabel(type: string, name: string) {
  if (type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return "PDF";
  return type || "Binary";
}

function deltaLabel(outputSize: number, sourceSize: number) {
  if (sourceSize <= 0) return "source size unavailable";
  const percent = Math.round(Math.abs(outputSize - sourceSize) / sourceSize * 100);
  if (outputSize === sourceSize) return "0% equal to source";
  return `${percent}% ${outputSize < sourceSize ? "smaller than" : "larger than"} source`;
}
