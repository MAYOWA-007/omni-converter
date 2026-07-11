import { expect, test } from "playwright/test";
import { createFileLaunchBridge, type FileLaunchParams, type FileLaunchQueue } from "../../src/core/fileLaunchQueue";

function fakeLaunchQueue() {
  let consumer: ((params: FileLaunchParams) => void) | null = null;
  const queue: FileLaunchQueue = {
    setConsumer(nextConsumer) {
      consumer = nextConsumer;
    }
  };
  return {
    queue,
    launch(params: FileLaunchParams) {
      if (!consumer) throw new Error("Launch consumer was not installed.");
      consumer(params);
    }
  };
}

test("queues a launched file until the workflow subscribes", async () => {
  const bridge = createFileLaunchBridge();
  const fake = fakeLaunchQueue();
  const file = new File(["ready"], "launch.txt", { type: "text/plain" });
  bridge.install(fake.queue);

  fake.launch({ files: [{ kind: "file", getFile: async () => file }] });
  await bridge.whenIdle();

  const received: File[] = [];
  const unsubscribe = bridge.subscribe((nextFile) => {
    received.push(nextFile);
  });
  await bridge.whenIdle();

  expect(received).toEqual([file]);
  unsubscribe();
});

test("serializes asynchronous launches and ignores non-file handles", async () => {
  const bridge = createFileLaunchBridge();
  const fake = fakeLaunchQueue();
  const first = new File(["one"], "one.txt");
  const second = new File(["two"], "two.txt");
  const received: string[] = [];
  bridge.install(fake.queue);
  bridge.subscribe(async (file) => {
    await Promise.resolve();
    received.push(file.name);
  });

  fake.launch({ files: [{ kind: "directory", getFile: async () => first }, { kind: "file", getFile: async () => first }] });
  fake.launch({ files: [{ kind: "file", getFile: async () => second }] });
  await bridge.whenIdle();

  expect(received).toEqual(["one.txt", "two.txt"]);
});

test("installs only one browser consumer", () => {
  const bridge = createFileLaunchBridge();
  let installs = 0;
  const queue: FileLaunchQueue = { setConsumer: () => { installs += 1; } };

  bridge.install(queue);
  bridge.install(queue);

  expect(installs).toBe(1);
});
