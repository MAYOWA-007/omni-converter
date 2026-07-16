import { expect, test, type Page } from "playwright/test";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function openImageCatalog(page: Page) {
  await page.goto("/");
  const input = page.locator('input[type="file"]');
  await expect(input).toHaveAttribute("tabindex", "-1");
  await input.setInputFiles({ name: "product-ui-proof.png", mimeType: "image/png", buffer: PNG_BYTES });
  await expect(page.getByRole("heading", { name: "What should it become?" })).toBeFocused();
}

test("conversion catalog uses a compact four-column command surface without clipped copy", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openImageCatalog(page);

  const commandBand = page.locator(".conversion-command-band");
  await expect(commandBand).toBeVisible();
  expect(await commandBand.evaluate((element) => getComputedStyle(element).position)).toBe("sticky");

  const geometry = await page.locator(".recipe-card").evaluateAll((cards) => {
    const rects = cards.map((card) => card.getBoundingClientRect());
    const firstTop = rects[0]?.top ?? 0;
    return {
      firstRow: rects.filter((rect) => Math.abs(rect.top - firstTop) < 2).length,
      descriptionsClipped: cards.some((card) => {
        const description = card.querySelector("p");
        return Boolean(description && description.scrollHeight > description.clientHeight + 1);
      }),
      maxTreatmentItems: Math.max(...cards.map((card) => card.querySelectorAll(".treatment-list > span").length))
    };
  });

  expect(geometry.firstRow).toBeLessThanOrEqual(4);
  expect(geometry.descriptionsClipped).toBe(false);
  expect(geometry.maxTreatmentItems).toBeLessThanOrEqual(3);

  const headingSize = await page.getByRole("heading", { name: "What should it become?" }).evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize));
  expect(headingSize).toBeLessThanOrEqual(44);
});

test("catalog remains one-column, readable, and contained at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openImageCatalog(page);

  const result = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>(".recipe-card")];
    const first = cards[0]?.getBoundingClientRect();
    const second = cards[1]?.getBoundingClientRect();
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      oneColumn: Boolean(first && second && second.top > first.bottom),
      cardFits: cards.every((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      })
    };
  });

  expect(result.pageWidth).toBeLessThanOrEqual(result.viewportWidth);
  expect(result.oneColumn).toBe(true);
  expect(result.cardFits).toBe(true);
});
