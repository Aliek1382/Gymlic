// Downscales + re-encodes an image entirely in the browser before upload.
// Avatars are only ever rendered at a few dozen pixels across, so there's no
// reason to store (or make users upload) full-resolution photos.
export async function compressImageToBlob(
  file: File,
  {
    maxDimension = 512,
    initialQuality = 0.9,
    maxBytes = 200 * 1024,
    minQuality = 0.5,
  }: {
    maxDimension?: number;
    initialQuality?: number;
    // Ceiling the output must fit under. A single fixed quality value can't
    // guarantee this on its own — a busy/detailed source photo can still
    // encode large even at the same quality setting — so quality is stepped
    // down automatically until the blob fits, instead of trusting one number.
    maxBytes?: number;
    minQuality?: number;
  } = {}
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("مرورگر شما از فشرده‌سازی تصویر پشتیبانی نمی‌کند.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  function encode(quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("فشرده‌سازی تصویر با خطا مواجه شد.")),
        "image/jpeg",
        quality
      );
    });
  }

  let quality = initialQuality;
  let blob = await encode(quality);
  while (blob.size > maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.1);
    blob = await encode(quality);
  }

  return blob;
}
