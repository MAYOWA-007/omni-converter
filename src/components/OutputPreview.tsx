import { FileQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import type { EngineResult } from "../engines/types";
import { formatBytes } from "../lib/formatting";

const TEXT_PREVIEW_LIMIT = 64 * 1024;

export function OutputPreview({ output }: { output: EngineResult[number] }) {
  const kind = previewKind(output);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "text") {
      let active = true;
      void output.blob.slice(0, TEXT_PREVIEW_LIMIT).text().then((value) => {
        if (active) setText(`${value}${output.blob.size > TEXT_PREVIEW_LIMIT ? "\n\nPreview truncated." : ""}`);
      }).catch(() => {
        if (active) setText("Preview unavailable.");
      });
      return () => { active = false; };
    }

    if (kind === "image" || kind === "audio" || kind === "video" || kind === "pdf") {
      const nextUrl = URL.createObjectURL(output.blob);
      setUrl(nextUrl);
      return () => {
        URL.revokeObjectURL(nextUrl);
      };
    }

    setUrl(null);
    setText(null);
    return undefined;
  }, [kind, output.blob]);

  if (kind === "image" && url) return <img className="output-preview-media" src={url} alt={`Preview of ${output.name}`} />;
  if (kind === "audio" && url) return <audio className="output-preview-media" controls src={url}>Audio preview</audio>;
  if (kind === "video" && url) return <video className="output-preview-media" controls src={url}>Video preview</video>;
  if (kind === "pdf" && url) return <object className="output-preview-object" data={url} type="application/pdf">PDF preview unavailable.</object>;
  if (kind === "text") return <pre className="output-preview-text">{text ?? "Loading preview..."}</pre>;

  return <p className="output-preview-binary"><FileQuestion size={18} /> {output.blob.type || "Binary file"} / {formatBytes(output.blob.size)}</p>;
}

function previewKind(output: EngineResult[number]) {
  const type = output.blob.type.toLowerCase();
  const extension = output.name.split(".").pop()?.toLowerCase();
  if (extension === "svg" || extension === "html" || extension === "htm" || extension === "json" || type.startsWith("text/") || type.includes("json")) return "text";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type === "application/pdf" || extension === "pdf") return "pdf";
  return "binary";
}
