import { ApiError, getApiBaseUrl, getToken } from "@/lib/api/client";

/**
 * A file from the API (not JSON): fetched with the session token and handed
 * to the browser as a download, named as the server's Content-Disposition
 * says (or `fallbackName`). An error response throws an ApiError with the
 * server's code and message.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload?.error?.message ?? "دریافت فایل ناموفق بود.",
      response.status,
      payload?.error?.code ?? "download_failed"
    );
  }

  const name =
    /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
