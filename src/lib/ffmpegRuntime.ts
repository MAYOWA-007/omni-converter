let coreAssetsPromise: Promise<{ coreURL: string; wasmURL: string }> | undefined;

export async function getFfmpegCoreAssets() {
  if (!coreAssetsPromise) {
    coreAssetsPromise = (async () => {
      const { toBlobURL } = await import("@ffmpeg/util");
      const base = new URL(import.meta.env.BASE_URL, window.location.origin);
      const core = new URL("assets/ffmpeg/ffmpeg-core.js", base).href;
      const wasm = new URL("assets/ffmpeg/ffmpeg-core.wasm", base).href;
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(core, "text/javascript"),
        toBlobURL(wasm, "application/wasm")
      ]);
      return { coreURL, wasmURL };
    })().catch((error) => {
      coreAssetsPromise = undefined;
      throw error;
    });
  }
  return coreAssetsPromise;
}
