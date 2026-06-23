import type { Locator, Page } from "@playwright/test";

export async function videoBottomStripLuma(page: Page, video: Locator): Promise<number> {
  const screenshot = await video.screenshot();
  return page.evaluate(
    async (dataUrl) => {
      const bitmap = new Image();
      bitmap.src = dataUrl;
      await bitmap.decode();
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.naturalWidth;
      canvas.height = bitmap.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D context unavailable.");
      context.drawImage(bitmap, 0, 0);
      const height = Math.min(36, canvas.height);
      const data = context.getImageData(0, canvas.height - height, canvas.width, height).data;
      let total = 0;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 0;
        const green = data[index + 1] ?? 0;
        const blue = data[index + 2] ?? 0;
        total += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      }
      return total / (data.length / 4);
    },
    `data:image/png;base64,${screenshot.toString("base64")}`,
  );
}
