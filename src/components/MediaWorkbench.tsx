import { AudioLines, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { sampleMediaTimelinePeaks } from "../lib/mediaInspection";
import { resolveMediaTrimRange } from "../lib/mediaTrim";
import type { ConversionSettings, FileInspection } from "../lib/types";

interface MediaWorkbenchProps {
  file: File;
  inspection: FileInspection;
  settings: ConversionSettings;
  onSettingsChange: (settings: ConversionSettings) => void;
}

export function MediaWorkbench({ file, inspection, settings, onSettingsChange }: MediaWorkbenchProps) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const sourceDuration = inspection.duration ?? 0;
  const range = useMemo(() => safeRange(settings, sourceDuration), [settings, sourceDuration]);
  const step = sourceDuration <= 10 ? 0.01 : sourceDuration <= 600 ? 0.1 : 1;
  const startPercent = sourceDuration ? range.start / sourceDuration * 100 : 0;
  const endPercent = sourceDuration ? range.end / sourceDuration * 100 : 100;
  const timelineStyle = {
    "--trim-start": `${startPercent}%`,
    "--trim-end": `${endPercent}%`
  } as CSSProperties;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const controller = new AbortController();
    setPeaks([]);
    void sampleMediaTimelinePeaks(file, 180, controller.signal).then(setPeaks).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setPeaks([]);
    });
    return () => controller.abort();
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => drawWaveform(canvas, peaks);
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks]);

  const updateRange = (start: number, end: number) => {
    const minimumGap = Math.min(step, Math.max(0.001, sourceDuration / 1000));
    const nextStart = roundTime(Math.max(0, Math.min(start, end - minimumGap)));
    const nextEnd = roundTime(Math.min(sourceDuration, Math.max(end, nextStart + minimumGap)));
    onSettingsChange({ ...settings, trim: "Custom range", trimStart: nextStart, trimEnd: nextEnd });
    const media = mediaRef.current;
    if (media && (media.currentTime < nextStart || media.currentTime > nextEnd)) media.currentTime = nextStart;
  };

  const togglePlayback = async () => {
    const media = mediaRef.current;
    if (!media) return;
    if (!media.paused) {
      media.pause();
      return;
    }
    if (media.currentTime < range.start || media.currentTime >= range.end) media.currentTime = range.start;
    await media.play().catch(() => undefined);
  };

  const onTimeUpdate = () => {
    const media = mediaRef.current;
    if (media && media.currentTime >= range.end) media.pause();
  };

  const mediaProps = {
    src: sourceUrl || undefined,
    preload: "metadata" as const,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onTimeUpdate
  };

  return (
    <section className="media-workbench" aria-label="Media trim editor">
      <div className={`media-preview-shell is-${inspection.family}`}>
        {inspection.family === "video"
          ? <video ref={(element) => { mediaRef.current = element; }} {...mediaProps} aria-label="Source video preview" playsInline onClick={() => void togglePlayback()} />
          : <><span className="audio-source-mark" role="img" aria-label="Audio source"><AudioLines size={30} aria-hidden="true" /></span><audio ref={(element) => { mediaRef.current = element; }} {...mediaProps} aria-label="Source audio preview" /></>}
      </div>
      <div className="media-timeline">
        <div className="media-time-row">
          <button type="button" className="timeline-play" onClick={() => void togglePlayback()} aria-label={playing ? "Pause selected range" : "Play selected range"} title={playing ? "Pause selected range" : "Play selected range"}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <output data-testid="trim-start-time">{formatTimelineTime(range.start)}</output>
          <span aria-hidden="true">/</span>
          <output data-testid="trim-end-time">{formatTimelineTime(range.end)}</output>
          <output className="trim-duration" data-testid="trim-duration">{formatTimelineTime(range.duration)}</output>
        </div>
        <div className="media-timeline-track" style={timelineStyle}>
          <canvas ref={canvasRef} aria-label="Media waveform" />
          <span className="trim-selection" aria-hidden="true" />
          <input className="trim-range trim-start" aria-label="Trim start" type="range" min={0} max={sourceDuration} step={step} value={range.start} onChange={(event) => updateRange(Number(event.target.value), range.end)} />
          <input className="trim-range trim-end" aria-label="Trim end" type="range" min={0} max={sourceDuration} step={step} value={range.end} onChange={(event) => updateRange(range.start, Number(event.target.value))} />
        </div>
      </div>
    </section>
  );
}

function safeRange(settings: ConversionSettings, duration: number) {
  try {
    return resolveMediaTrimRange(settings, duration);
  } catch {
    return { start: 0, end: Math.max(0, duration), duration: Math.max(0, duration) };
  }
}

function drawWaveform(canvas: HTMLCanvasElement, peaks: number[]) {
  const width = Math.max(1, Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)));
  const height = Math.max(1, Math.round(canvas.clientHeight * Math.min(window.devicePixelRatio || 1, 2)));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const styles = getComputedStyle(canvas);
  context.fillStyle = styles.getPropertyValue("--timeline-wave").trim() || "#d7b76d";
  const values = peaks.length ? peaks : Array.from({ length: 72 }, (_, index) => 0.16 + Math.sin(index * 0.72) ** 2 * 0.12);
  const barWidth = width / values.length;
  for (let index = 0; index < values.length; index += 1) {
    const amplitude = Math.max(1, values[index] * height * 0.82);
    context.fillRect(index * barWidth, (height - amplitude) / 2, Math.max(1, barWidth * 0.5), amplitude);
  }
}

function formatTimelineTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000);
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}
