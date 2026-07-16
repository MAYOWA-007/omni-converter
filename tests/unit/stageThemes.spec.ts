import { expect, test } from "playwright/test";
import { STAGE_BACKDROPS, themeForStage } from "../../src/design/stageThemes";

test("maps each workflow stage to one intentional material backdrop", () => {
  expect(themeForStage("drop")).toBe("oxblood");
  expect(themeForStage("analyzing")).toBe("cream");
  expect(themeForStage("choose")).toBe("soot");
  expect(themeForStage("processing")).toBe("soot");
  expect(themeForStage("edit")).toBe("emerald");
  expect(themeForStage("results")).toBe("emerald");
});

test("defines one fixed atlas view per material without duplicate positions", () => {
  expect(STAGE_BACKDROPS).toHaveLength(4);
  expect(new Set(STAGE_BACKDROPS.map(({ theme }) => theme)).size).toBe(4);
  expect(new Set(STAGE_BACKDROPS.map(({ atlasPosition }) => atlasPosition)).size).toBe(4);
});
