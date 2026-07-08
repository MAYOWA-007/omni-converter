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

interface Point2 {
  x: number;
  y: number;
  z: number;
}

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
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let frame = 0;
    let start = performance.now();

    function resize() {
      const width = Math.max(1, canvasNode.clientWidth);
      const height = Math.max(1, canvasNode.clientHeight);
      const nextWidth = Math.floor(width * dpr);
      const nextHeight = Math.floor(height * dpr);
      if (canvasNode.width !== nextWidth || canvasNode.height !== nextHeight) {
        canvasNode.width = nextWidth;
        canvasNode.height = nextHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    }

    function render(now = performance.now()) {
      const { width, height } = resize();
      const elapsed = (now - start) / 1000;
      const energy = active ? 1.75 : fileLoaded ? 1.2 : 1;
      const radius = Math.min(width, height) * (active ? 0.345 : 0.335);
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = active ? 10 : 4;
      ctx.shadowColor = active ? "rgba(243, 220, 157, 0.26)" : "rgba(215, 183, 109, 0.18)";

      const rotationY = elapsed * 0.34 * energy;
      const rotationX = Math.sin(elapsed * 0.22) * 0.16;
      const rotationZ = elapsed * 0.035;

      drawSphere(ctx, centerX, centerY, radius, rotationX, rotationY, rotationZ, {
        line: active ? "rgba(255, 236, 178, 0.82)" : "rgba(243, 220, 157, 0.66)",
        point: active ? "rgba(255, 250, 240, 0.72)" : "rgba(255, 250, 240, 0.48)",
        alpha: active ? 1 : 0.86
      });

      drawSphere(ctx, centerX, centerY, radius * 0.72, -rotationX * 0.7, -rotationY * 0.8, -rotationZ, {
        line: active ? "rgba(205, 108, 101, 0.42)" : "rgba(200, 106, 98, 0.28)",
        point: "rgba(215, 183, 109, 0)",
        alpha: 0.55
      });

      if (!reducedMotion) {
        frame = requestAnimationFrame(render);
      }
    }

    render();

    return () => {
      cancelAnimationFrame(frame);
      start = 0;
    };
  }, [active, fileLoaded]);

  return <canvas ref={canvasRef} className="vortex-canvas" aria-hidden="true" />;
}

function drawSphere(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  paint: { line: string; point: string; alpha: number }
) {
  context.save();
  context.globalAlpha = paint.alpha;
  context.strokeStyle = paint.line;
  context.lineWidth = Math.max(0.55, radius / 520);

  for (let lat = -70; lat <= 70; lat += 10) {
    const theta = degrees(lat);
    const path = sampleCurve((step) => {
      const phi = step * Math.PI * 2;
      return {
        x: Math.cos(theta) * Math.cos(phi),
        y: Math.sin(theta),
        z: Math.cos(theta) * Math.sin(phi)
      };
    });
    drawPath(context, path, centerX, centerY, radius, rotationX, rotationY, rotationZ);
  }

  for (let lon = 0; lon < 180; lon += 10) {
    const phi = degrees(lon);
    const path = sampleCurve((step) => {
      const theta = -Math.PI / 2 + step * Math.PI;
      return {
        x: Math.cos(theta) * Math.cos(phi),
        y: Math.sin(theta),
        z: Math.cos(theta) * Math.sin(phi)
      };
    });
    drawPath(context, path, centerX, centerY, radius, rotationX, rotationY, rotationZ);
  }

  context.globalAlpha = paint.alpha * 0.58;
  for (let offset = 0; offset < Math.PI * 2; offset += Math.PI / 7) {
    const path = sampleCurve((step) => {
      const theta = -Math.PI / 2 + step * Math.PI;
      const phi = offset + theta * 1.18;
      return {
        x: Math.cos(theta) * Math.cos(phi),
        y: Math.sin(theta),
        z: Math.cos(theta) * Math.sin(phi)
      };
    });
    drawPath(context, path, centerX, centerY, radius, rotationX, rotationY, rotationZ);
  }

  if (paint.point !== "rgba(215, 183, 109, 0)") {
    context.globalAlpha = 1;
    context.fillStyle = paint.point;
    for (let lat = -50; lat <= 50; lat += 20) {
      for (let lon = 0; lon < 360; lon += 24) {
        const theta = degrees(lat);
        const phi = degrees(lon);
        const point = project(
          rotate(
            {
              x: Math.cos(theta) * Math.cos(phi),
              y: Math.sin(theta),
              z: Math.cos(theta) * Math.sin(phi)
            },
            rotationX,
            rotationY,
            rotationZ
          ),
          centerX,
          centerY,
          radius
        );
        const visible = 0.42 + (point.z + 1) * 0.24;
        context.globalAlpha = Math.max(0.18, Math.min(0.72, visible));
        context.beginPath();
        context.arc(point.x, point.y, Math.max(0.8, radius / 310), 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  context.restore();
}

function sampleCurve(getPoint: (step: number) => Point3) {
  const points: Point3[] = [];
  for (let index = 0; index <= 96; index += 1) {
    points.push(getPoint(index / 96));
  }
  return points;
}

function drawPath(
  context: CanvasRenderingContext2D,
  points: Point3[],
  centerX: number,
  centerY: number,
  radius: number,
  rotationX: number,
  rotationY: number,
  rotationZ: number
) {
  context.beginPath();
  points.forEach((point, index) => {
    const projected = project(rotate(point, rotationX, rotationY, rotationZ), centerX, centerY, radius);
    if (index === 0) context.moveTo(projected.x, projected.y);
    else context.lineTo(projected.x, projected.y);
  });
  context.stroke();
}

function rotate(point: Point3, rotationX: number, rotationY: number, rotationZ: number): Point3 {
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const cosZ = Math.cos(rotationZ);
  const sinZ = Math.sin(rotationZ);

  const y1 = point.y * cosX - point.z * sinX;
  const z1 = point.y * sinX + point.z * cosX;
  const x2 = point.x * cosY + z1 * sinY;
  const z2 = -point.x * sinY + z1 * cosY;
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return { x: x3, y: y3, z: z2 };
}

function project(point: Point3, centerX: number, centerY: number, radius: number): Point2 {
  const depth = 1 + point.z * 0.06;
  return {
    x: centerX + point.x * radius * depth,
    y: centerY + point.y * radius * depth,
    z: point.z
  };
}

function degrees(value: number) {
  return (value / 180) * Math.PI;
}
