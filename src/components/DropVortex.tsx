import { Upload } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

const VortexScene = lazy(() => import("./VortexScene").then((module) => ({ default: module.VortexScene })));

interface DropVortexProps {
  active: boolean;
  fileLoaded: boolean;
  onFile: (file: File) => void;
  onDragActive: (active: boolean) => void;
}

export function DropVortex({ active, fileLoaded, onFile, onDragActive }: DropVortexProps) {
  const [hovered, setHovered] = useState(false);
  const [showVortex, setShowVortex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const idleWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
    let cancelled = false;
    let delayId = 0;
    let timeoutId = 0;
    let idleId = 0;

    const loadVortex = () => {
      timeoutId = window.setTimeout(() => {
        if (!cancelled) setShowVortex(true);
      }, 120);
    };

    delayId = window.setTimeout(() => {
      if (cancelled) return;
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(loadVortex, { timeout: 1600 });
      } else {
        idleId = idleWindow.setTimeout(loadVortex, 0);
      }
    }, 2800);

    return () => {
      cancelled = true;
      window.clearTimeout(delayId);
      if (idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId);
      } else {
        idleWindow.clearTimeout(idleId);
      }
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (active || hovered) setShowVortex(true);
  }, [active, hovered]);

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
      <div className="vortex-shell">
        {showVortex ? (
          <Suspense fallback={<div className="vortex-canvas vortex-fallback" aria-hidden="true" />}>
            <VortexScene active={active || hovered} fileLoaded={fileLoaded} />
          </Suspense>
        ) : (
          <div className="vortex-canvas vortex-fallback" aria-hidden="true" />
        )}
      </div>
      <label
        className="drop-core"
        tabIndex={0}
        aria-label="Drop any file"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input ref={inputRef} type="file" onChange={(event) => handleFiles(event.target.files)} />
        <span className="drop-copy">
          <Upload size={18} strokeWidth={1.6} />
          Drop any file
        </span>
      </label>
    </section>
  );
}
