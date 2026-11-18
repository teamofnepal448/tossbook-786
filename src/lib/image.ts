/**
 * Client-side image compression for uploaded match posters and banners.
 * Keeps data URLs lightweight (<250KB) for fast mobile rendering and DB storage.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1200,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        reject(new Error("Empty image data"));
        return;
      }

      // Small files (< 180KB) can be kept as-is to preserve crisp PNG transparency
      if (dataUrl.length < 240_000) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          // Use webp when supported for optimal size, fallback to jpeg
          const webp = canvas.toDataURL("image/webp", quality);
          if (webp.startsWith("data:image/webp") && webp.length < dataUrl.length) {
            resolve(webp);
            return;
          }
          const jpeg = canvas.toDataURL("image/jpeg", quality);
          resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
