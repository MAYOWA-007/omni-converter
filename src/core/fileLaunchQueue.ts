export interface FileLaunchHandle {
  kind: string;
  getFile(): Promise<File>;
}

export interface FileLaunchParams {
  files?: readonly FileLaunchHandle[];
}

export interface FileLaunchQueue {
  setConsumer(consumer: (params: FileLaunchParams) => void): void;
}

export type LaunchedFileConsumer = (file: File) => void | Promise<void>;
type LaunchErrorConsumer = (error: unknown) => void;

export function createFileLaunchBridge() {
  let installed = false;
  let pending: File[] = [];
  let subscriber: LaunchedFileConsumer | null = null;
  let reportError: LaunchErrorConsumer = () => {};
  let launchChain = Promise.resolve();
  let deliveryChain = Promise.resolve();

  function scheduleDelivery() {
    deliveryChain = deliveryChain.then(async () => {
      while (subscriber && pending.length > 0) {
        const nextFile = pending.shift();
        const nextSubscriber = subscriber;
        if (!nextFile) continue;
        try {
          await nextSubscriber(nextFile);
        } catch (error) {
          reportError(error);
        }
      }
    });
  }

  return {
    install(queue: FileLaunchQueue | undefined, onError: LaunchErrorConsumer = () => {}) {
      if (installed || !queue) return;
      installed = true;
      reportError = onError;
      queue.setConsumer((params) => {
        launchChain = launchChain.then(async () => {
          for (const handle of params.files ?? []) {
            if (handle.kind !== "file") continue;
            try {
              const file = await handle.getFile();
              if (!(file instanceof File)) throw new TypeError("The launch handle did not provide a file.");
              pending.push(file);
              scheduleDelivery();
            } catch (error) {
              reportError(error);
            }
          }
        });
      });
    },

    subscribe(consumer: LaunchedFileConsumer) {
      subscriber = consumer;
      scheduleDelivery();
      return () => {
        if (subscriber === consumer) subscriber = null;
      };
    },

    async whenIdle() {
      while (true) {
        const observedLaunches = launchChain;
        await observedLaunches;
        const observedDeliveries = deliveryChain;
        await observedDeliveries;
        if (observedLaunches === launchChain && observedDeliveries === deliveryChain) return;
      }
    },

    clear() {
      pending = [];
    }
  };
}

export const fileLaunchBridge = createFileLaunchBridge();

declare global {
  interface Window {
    launchQueue?: FileLaunchQueue;
  }
}
