import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { fileLaunchBridge } from "./core/fileLaunchQueue";

fileLaunchBridge.install(window.launchQueue, (error) => {
  window.dispatchEvent(new CustomEvent("omni:file-launch-error", {
    detail: { message: error instanceof Error ? error.message : "The launched file could not be opened." }
  }));
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    void registerServiceWorker();
  }, { once: true });
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none"
    });

    notifyWhenUpdateWaits(registration);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.dispatchEvent(new CustomEvent("omni:pwa-controller-change"));
    });
  } catch (error) {
    window.dispatchEvent(new CustomEvent("omni:pwa-error", {
      detail: { message: error instanceof Error ? error.message : "Service worker registration failed." }
    }));
  }
}

function notifyWhenUpdateWaits(registration: ServiceWorkerRegistration) {
  const notify = () => {
    window.dispatchEvent(new CustomEvent("omni:pwa-update-ready", { detail: { registration } }));
  };
  if (registration.waiting) notify();
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) notify();
    });
  });
}
