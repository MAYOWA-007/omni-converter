/// <reference types="vite/client" />

declare module "mammoth/mammoth.browser" {
  const mammoth: typeof import("mammoth");
  export = mammoth;
}
