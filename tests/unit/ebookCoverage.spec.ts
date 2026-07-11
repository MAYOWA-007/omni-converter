import { expect, test } from "playwright/test";
import { CONVERSION_RECIPES } from "../../src/data/conversionMatrix";
import { VERIFIED_EBOOK_RECIPE_CONTRACTS } from "../../src/data/verifiedEbookRecipes";

test("every verified ebook recipe has one executable EPUB contract", () => {
  for (const contract of VERIFIED_EBOOK_RECIPE_CONTRACTS) {
    const recipe = CONVERSION_RECIPES.find((entry) => entry.id === contract.recipeId);
    expect(recipe).toMatchObject({
      inputFormats: ["epub"],
      maturity: "verified",
      runtimes: ["browser"],
      implementation: "ready"
    });
    expect(contract.differentialControls).toEqual(expect.arrayContaining(recipe!.editorControls));
  }
});

test("MOBI is not promoted through the EPUB package reader", () => {
  expect(CONVERSION_RECIPES.find((entry) => entry.id === "ebook-to-text")?.inputFormats).not.toContain("mobi");
});
