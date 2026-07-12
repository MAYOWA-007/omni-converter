import { useEffect, useRef, useState } from "react";

interface VortexSceneProps {
  active: boolean;
  fileLoaded: boolean;
}

type VortexState = "loading" | "ready" | "fallback";

declare global {
  interface Window {
    __omniVortex?: { frames: number; paused: boolean; state: VortexState };
  }
}

export function VortexScene({ active, fileLoaded }: VortexSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activityRef = useRef({ active, fileLoaded });
  const [sceneState, setSceneState] = useState<VortexState>("loading");
  activityRef.current = { active, fileLoaded };

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const canvasElement: HTMLCanvasElement = canvasNode;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stats = { frames: 0, paused: true, state: "loading" as VortexState };
    let disposed = false;
    let teardown = () => {};
    window.__omniVortex = stats;

    function showFallback() {
      if (disposed) return;
      stats.paused = true;
      stats.state = "fallback";
      setSceneState("fallback");
    }

    async function initialize() {
      try {
        const [
          { BufferGeometry },
          { Float32BufferAttribute },
          { PerspectiveCamera },
          { Color },
          { LineBasicMaterial },
          { LineSegments },
          { WebGLRenderer },
          { Scene }
        ] = await Promise.all([
          import("three/src/core/BufferGeometry.js"),
          import("three/src/core/BufferAttribute.js"),
          import("three/src/cameras/PerspectiveCamera.js"),
          import("three/src/math/Color.js"),
          import("three/src/materials/LineBasicMaterial.js"),
          import("three/src/objects/LineSegments.js"),
          import("three/src/renderers/WebGLRenderer.js"),
          import("three/src/scenes/Scene.js")
        ]);
        if (disposed) return;

        const renderer = new WebGLRenderer({ alpha: true, antialias: true, canvas: canvasElement });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1 : 1.15));
        const scene = new Scene();
        const camera = new PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.z = 4.15;
        const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(createGlobePositions(), 3));
        const material = new LineBasicMaterial({ color: new Color("#e8c979"), transparent: true, opacity: 0.74 });
        const sphere = new LineSegments(geometry, material);
        scene.add(sphere);

        let frame = 0;
        let lastFrame = 0;
        let running = false;
        let resourcesDisposed = false;
        let appearance = "";

        function render(elapsed: number) {
          const state = activityRef.current;
          const energy = state.active ? 1.55 : state.fileLoaded ? 1.15 : 1;
          sphere.rotation.y = elapsed * 0.00028 * energy;
          sphere.rotation.x = 0.2 + Math.sin(elapsed * 0.00014) * 0.12;
          sphere.rotation.z = elapsed * 0.00006;
          const nextAppearance = state.active ? "active" : state.fileLoaded ? "loaded" : "idle";
          if (nextAppearance !== appearance) {
            appearance = nextAppearance;
            material.color.set(state.active ? "#f0d28a" : state.fileLoaded ? "#9fcbb1" : "#e8c979");
            material.opacity = state.active ? 0.92 : 0.74;
          }
          renderer.render(scene, camera);
        }

        function resize() {
          if (resourcesDisposed) return;
          const width = Math.max(1, canvasElement.clientWidth);
          const height = Math.max(1, canvasElement.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          const visibleHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
          const diameter = Math.min(width, height) * 0.9;
          sphere.scale.setScalar((diameter / height) * visibleHeight / 2.68);
          render(0);
        }

        function tick(now: number) {
          if (disposed || resourcesDisposed || document.hidden || reducedMotion) return;
          const targetFps = 60;
          const frameInterval = 1000 / targetFps;
          if (now - lastFrame >= frameInterval - 1) {
            lastFrame = now - ((now - lastFrame) % frameInterval);
            render(now);
            stats.frames += 1;
          }
          frame = requestAnimationFrame(tick);
        }

        function start() {
          if (running || disposed || resourcesDisposed || document.hidden || reducedMotion) return;
          running = true;
          stats.paused = false;
          lastFrame = 0;
          frame = requestAnimationFrame(tick);
        }

        function stop() {
          running = false;
          stats.paused = true;
          cancelAnimationFrame(frame);
        }

        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
        const onVisibilityChange = () => document.hidden ? stop() : start();
        const disposeResources = () => {
          if (resourcesDisposed) return;
          resourcesDisposed = true;
          stop();
          observer?.disconnect();
          document.removeEventListener("visibilitychange", onVisibilityChange);
          canvasElement.removeEventListener("webglcontextlost", onContextLost);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
        };
        const onContextLost = (event: Event) => {
          event.preventDefault();
          disposeResources();
          showFallback();
        };

        teardown = disposeResources;
        observer?.observe(canvasElement);
        document.addEventListener("visibilitychange", onVisibilityChange);
        canvasElement.addEventListener("webglcontextlost", onContextLost);
        resize();
        stats.paused = document.hidden || reducedMotion;
        stats.state = "ready";
        setSceneState("ready");
        start();
      } catch {
        showFallback();
      }
    }

    void initialize();

    return () => {
      disposed = true;
      teardown();
      if (window.__omniVortex === stats) window.__omniVortex = undefined;
    };
  }, []);

  return (
    <>
      {sceneState !== "ready" ? <div className="vortex-canvas vortex-fallback vortex-runtime-fallback" role="img" aria-label="Static wire globe" data-vortex-state={sceneState} /> : null}
      <canvas ref={canvasRef} className={`vortex-canvas vortex-three-canvas ${sceneState === "ready" ? "is-ready" : "is-hidden"}`} data-vortex-scene="three" data-vortex-topology="latitude-longitude" aria-hidden="true" />
    </>
  );
}

function createGlobePositions() {
  const radius = 1.34;
  const positions: number[] = [];
  const addPoint = (x: number, y: number, z: number) => positions.push(x, y, z);
  const steps = 72;

  for (let latitude = -60; latitude <= 60; latitude += 20) {
    const phi = latitude * Math.PI / 180;
    for (let step = 0; step < steps; step += 1) {
      const start = step / steps * Math.PI * 2;
      const end = (step + 1) / steps * Math.PI * 2;
      addPoint(radius * Math.cos(phi) * Math.cos(start), radius * Math.sin(phi), radius * Math.cos(phi) * Math.sin(start));
      addPoint(radius * Math.cos(phi) * Math.cos(end), radius * Math.sin(phi), radius * Math.cos(phi) * Math.sin(end));
    }
  }

  for (let longitude = 0; longitude < 360; longitude += 30) {
    const theta = longitude * Math.PI / 180;
    for (let step = 0; step < steps; step += 1) {
      const start = -Math.PI / 2 + step / steps * Math.PI;
      const end = -Math.PI / 2 + (step + 1) / steps * Math.PI;
      addPoint(radius * Math.cos(start) * Math.cos(theta), radius * Math.sin(start), radius * Math.cos(start) * Math.sin(theta));
      addPoint(radius * Math.cos(end) * Math.cos(theta), radius * Math.sin(end), radius * Math.cos(end) * Math.sin(theta));
    }
  }

  return positions;
}
