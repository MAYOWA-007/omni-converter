import { Ban, Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ConversionJob } from "../core/jobs";
import type { PreflightResult } from "../lib/types";

interface ProcessingScreenProps {
  job: ConversionJob | null;
  estimate: PreflightResult | null;
  canCancel: boolean;
  onCancel: () => void;
}

export function ProcessingScreen({ job, estimate, canCancel, onCancel }: ProcessingScreenProps) {
  const [now, setNow] = useState(Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const progress = job?.progress.value ?? 0;
  const label = job?.state === "canceling" ? "Canceling" : job?.progress.label ?? phaseLabel(job?.progress.phase);
  const elapsed = formatElapsed(job?.startedAt, now);
  const showCancel = canCancel && (job?.state === "running" || job?.state === "paused" || job?.state === "canceling");

  return (
    <section className="screen processing-screen" aria-labelledby="processing-title">
      <div className="processing-layout">
        <p className="screen-kicker">Processing</p>
        <h1 ref={headingRef} id="processing-title" tabIndex={-1}>{label}</h1>
        <progress aria-label="Conversion progress" value={progress} max={100}>{progress}%</progress>
        <p className="processing-percent" aria-live="polite">{progress}%</p>
        <dl className="processing-facts">
          <div><dt><Clock3 size={15} /> Elapsed</dt><dd>{elapsed}</dd></div>
          {estimate?.estimate ? <div><dt>Estimate</dt><dd>{estimate.estimate}</dd></div> : null}
        </dl>
        {showCancel ? (
          <button className="ghost-action processing-cancel" type="button" disabled={job?.state === "canceling"} onClick={onCancel}>
            <Ban size={16} />
            {job?.state === "canceling" ? "Canceling" : "Cancel"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function phaseLabel(phase?: ConversionJob["progress"]["phase"]) {
  return ({ queued: "Queued", analysis: "Analyzing", conversion: "Converting", validation: "Validating", complete: "Complete" }[phase ?? "queued"]);
}

function formatElapsed(startedAt: string | undefined, now: number) {
  if (!startedAt) return "0:00";
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
