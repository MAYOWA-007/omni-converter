import { Upload } from "lucide-react";
import { lazy, Suspense, useState } from "react";

const VortexScene = lazy(() => import("./VortexScene").then((module) => ({ default: module.VortexScene })));

interface DropVortexProps {
  active: boolean;
  fileLoaded: boolean;
  onFile: (file: File) => void;
  onDragActive: (active: boolean) => void;
}

export function DropVortex({ active, fileLoaded, onFile, onDragActive }: DropVortexProps) {
  const [hovered, setHovered] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  return (
    <section
      className={`drop-stage ${active ? "is-active" : ""} ${fileLoaded ? "has-file" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) onDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragActive(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <Suspense fallback={<div className="vortex-canvas vortex-fallback" aria-hidden="true" />}>
        <VortexScene active={active || hovered} fileLoaded={fileLoaded} />
      </Suspense>
      <label
        className="drop-core"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <input type="file" onChange={(event) => handleFiles(event.target.files)} />
        <span className="drop-copy">
          <Upload size={18} strokeWidth={1.6} />
          Drop any file
        </span>
      </label>
    </section>
  );
}
