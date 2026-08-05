// Downscales + re-encodes an image entirely in the browser before upload.
// Avatars are only ever rendered at a few dozen pixels across, so there's no
// reason to store (or make users upload) full-resolution photos.
export async function compressImageToBlob(
  file: File,
  { maxDimension = 512, quality = 0.82 }: { maxDimension?: number; quality?: number } = {}
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

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("فشرده‌سازی تصویر با خطا مواجه شد.");
  return blob;
}
