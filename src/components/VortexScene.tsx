import { useEffect, useRef } from "react";

interface VortexSceneProps {
  active: boolean;
  fileLoaded: boolean;
}

interface Point3 {
  x: number;
  y: number;
  z: number;
}

interface Rotation {
  cosX: number;
  sinX: number;
  cosY: number;
  sinY: number;
  cosZ: number;
  sinZ: number;
}

const PRIMARY_PATHS = createWirePaths();
const SECONDARY_PATHS = PRIMARY_PATHS.filter((_, index) => index % 2 === 0);
const DOTS = createDots();

export function VortexScene({ active, fileLoaded }: VortexSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const context = canvasElement.getContext("2d", { alpha: true });
    if (!context) return;

    const canvasNode: HTMLCanvasElement = canvasElement;
    const ctx: CanvasRenderingContext2D = context;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1 : 1.2);
    let width = 1;
    let height = 1;
    let frame = 0;
    let lastFrame = 0;
    let disposed = false;
    const start = performance.now();

    function resize() {
      const nextWidth = Math.max(1, canvasNode.clientWidth);
      const nextHeight = Math.max(1, canvasNode.clientHeight);
      const nextCanvasWidth = Math.floor(nextWidth * dpr);
      const nextCanvasHeight = Math.floor(nextHeight * dpr);
      width = nextWidth;
      height = nextHeight;

      if (canvasNode.width !== nextCanvasWidth || canvasNode.height !== nextCanvasHeight) {
        canvasNode.width = nextCanvasWidth;
        canvasNode.height = nextCanvasHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }

    function schedule() {
      if (!disposed && !reducedMotion && !document.hidden) {
        frame = requestAnimationFrame(render);
      }
    }

    function render(now = performance.now()) {
      const targetFps = active ? 24 : 16;
      const interval = 1000 / targetFps;

      if (now - lastFrame < interval) {
        schedule();
        return;
      }

      lastFrame = now;
      const elapsed = (now - start) / 1000;
      const energy = active ? 1.65 : fileLoaded ? 1.15 : 1;
      const radius = Math.min(width, height) * (active ? 0.345 : 0.335);
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = active ? 3 : 0;
      ctx.shadowColor = "rgba(243, 220, 157, 0.18)";

      const rotationY = elapsed * 0.3 * energy;
      const rotationX = Math.sin(elapsed * 0.2) * 0.14;
      const rotationZ = elapsed * 0.03;

      drawSphere(ctx, PRIMARY_PATHS, DOTS, centerX, centerY, radius, rotationX, rotationY, rotationZ, {
        line: active ? "rgba(255, 236, 178, 0.82)" : "rgba(243, 220, 157, 0.64)",
        point: active ? "rgba(255, 250, 240, 0.7)" : "rgba(255, 250, 240, 0.44)",
        alpha: active ? 1 : 0.84
      });

      drawSphere(ctx, SECONDARY_PATHS, null, centerX, centerY, radius * 0.72, -rotationX * 0.7, -rotationY * 0.78, -rotationZ, {
        line: active ? "rgba(205, 108, 101, 0.38)" : "rgba(200, 106, 98, 0.24)",
        point: "transparent",
        alpha: 0.5
      });

      schedule();
    }

    function handleVisibility() {
      if (!document.hidden && !disposed && !reducedMotion) {
        lastFrame = 0;
        frame = requestAnimationFrame(render);
      }
    }

    resize();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvasNode);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, fileLoaded]);

  return <canvas ref={canvasRef} className="vortex-canvas" aria-hidden="true" />;
}

function drawSphere(
  context: CanvasRenderingContext2D,
  paths: Point3[][],
  dots: Point3[] | null,
  centerX: number,
  centerY: number,
  radius: number,
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  paint: { line: string; point: string; alpha: number }
) {
  const rotation = rotationValues(rotationX, rotationY, rotationZ);
  context.save();
  context.globalAlpha = paint.alpha;
  context.strokeStyle = paint.line;
  context.lineWidth = Math.max(0.5, radius / 560);

  for (let index = 0; index < paths.length; index += 1) {
    drawPath(context, paths[index], centerX, centerY, radius, rotation);
  }

  if (dots) {
    context.globalAlpha = 1;
    context.fillStyle = paint.point;
    for (let index = 0; index < dots.length; index += 1) {
      drawDot(context, dots[index], centerX, centerY, radius, rotation);
    }
  }

  context.restore();
}

function createWirePaths() {
  const paths: Point3[][] = [];

  for (let lat = -60; lat <= 60; lat += 15) {
    const theta = degrees(lat);
    paths.push(sampleCurve((step) => {
      const phi = step * Math.PI * 2;
      return {
        x: Math.cos(theta) * Math.cos(phi),
        y: Math.sin(theta),
        z: Math.cos(theta) * Math.sin(phi)
      };
    }));
  }

  for (let lon = 0; lon < 180; lon += 15) {
    const phi = degrees(lon);
    paths.push(sampleCurve((step) => {
      const theta = -Math.PI / 2 + step * Math.PI;
      return {
        x: Math.cos(theta) * Math.cos(phi),
        y: Math.sin(theta),
        z: Math.cos(theta) * Math.sin(phi)
      };
    }));
  }

  for (let offset = 0; offset < Math.PI * 2; offset += Math.PI / 5) {
    paths.push(sampleCurve((step) => {
      const theta = -Math.PI / 2 + step * Math.PI;
      const phi = offset + theta * 1.18;
      return {
        x: Math.cos(theta) * Math.cos(phi),
        y: Math.sin(theta),
        z: Math.cos(theta) * Math.sin(phi)
      };
    }));
  }

  return paths;
}

function createDots() {
  const dots: Point3[] = [];
  for (let lat = -45; lat <= 45; lat += 22.5) {
    for (let lon = 0; lon < 360; lon += 36) {
      const theta = degrees(lat);
      const phi = degrees(lon);
      dots.push({
        x: Math.cos(theta) * Math.cos(phi),
        y: Math.sin(theta),
        z: Math.cos(theta) * Math.sin(phi)
      });
    }
  }
  return dots;
}

function sampleCurve(getPoint: (step: number) => Point3) {
  const points: Point3[] = [];
  const samples = 48;
  for (let index = 0; index <= samples; index += 1) {
    points.push(getPoint(index / samples));
  }
  return points;
}

function drawPath(context: CanvasRenderingContext2D, points: Point3[], centerX: number, centerY: number, radius: number, rotation: Rotation) {
  context.beginPath();

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const y1 = point.y * rotation.cosX - point.z * rotation.sinX;
    const z1 = point.y * rotation.sinX + point.z * rotation.cosX;
    const x2 = point.x * rotation.cosY + z1 * rotation.sinY;
    const z2 = -point.x * rotation.sinY + z1 * rotation.cosY;
    const x3 = x2 * rotation.cosZ - y1 * rotation.sinZ;
    const y3 = x2 * rotation.sinZ + y1 * rotation.cosZ;
    const depth = 1 + z2 * 0.06;
    const x = centerX + x3 * radius * depth;
    const y = centerY + y3 * radius * depth;

    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }

  context.stroke();
}

function drawDot(context: CanvasRenderingContext2D, point: Point3, centerX: number, centerY: number, radius: number, rotation: Rotation) {
  const y1 = point.y * rotation.cosX - point.z * rotation.sinX;
  const z1 = point.y * rotation.sinX + point.z * rotation.cosX;
  const x2 = point.x * rotation.cosY + z1 * rotation.sinY;
  const z2 = -point.x * rotation.sinY + z1 * rotation.cosY;
  const x3 = x2 * rotation.cosZ - y1 * rotation.sinZ;
  const y3 = x2 * rotation.sinZ + y1 * rotation.cosZ;
  const depth = 1 + z2 * 0.06;
  const visible = 0.42 + (z2 + 1) * 0.24;

  context.globalAlpha = Math.max(0.18, Math.min(0.7, visible));
  context.beginPath();
  context.arc(centerX + x3 * radius * depth, centerY + y3 * radius * depth, Math.max(0.7, radius / 330), 0, Math.PI * 2);
  context.fill();
}

function rotationValues(rotationX: number, rotationY: number, rotationZ: number): Rotation {
  return {
    cosX: Math.cos(rotationX),
    sinX: Math.sin(rotationX),
    cosY: Math.cos(rotationY),
    sinY: Math.sin(rotationY),
    cosZ: Math.cos(rotationZ),
    sinZ: Math.sin(rotationZ)
  };
}

function degrees(value: number) {
  return (value / 180) * Math.PI;
}
