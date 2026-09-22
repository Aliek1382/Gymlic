/**
 * Client for the Gymlic PHP API, replacing supabase-js.
 *
 * The app ships as a static export, so the API base URL is substituted into
 * the bundle at build time — not read at runtime. The session token is kept
 * in localStorage and sent as a bearer header, the same shape the Supabase
 * JWT had: the static site and the API normally sit on different subdomains
 * of the same host, where cross-site cookies are unreliable.
 */

const TOKEN_STORAGE_KEY = "gymlic.token";

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;

  // These values are baked in at build time, not read when the page runs, so
  // a build that ran without them ships files with `undefined` in every URL
  // and fails at runtime with nothing explaining why. Naming the cause here
  // keeps a misconfigured deployment diagnosable from the browser.
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL هنگام build تعریف نشده بود. این مقدار در زمان build " +
        "داخل فایل‌های خروجی درج می‌شود و نه هنگام اجرا، پس تعریف‌کردن آن به‌تنهایی " +
        "کافی نیست: بعد از تنظیم، باید دوباره build و آپلود کنید. در اجرای محلی " +
        "فایل .env.local را بسازید."
    );
  }

  return url.replace(/\/$/, "");
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Private-mode browsers can throw on access rather than return null.
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token === null) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // Nothing to do: an unwritable store just means the session won't persist.
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const FALLBACK_MESSAGE_BY_STATUS: Record<number, string> = {
  401: "نشست شما منقضی شده است. دوباره وارد شوید.",
  403: "به این بخش دسترسی ندارید.",
  404: "موردی پیدا نشد.",
  500: "خطای سرور. لطفاً دوباره تلاش کنید.",
};

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; formData?: FormData } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    // Let the browser set the multipart boundary itself.
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { method, headers, body });
  } catch {
    throw new ApiError(
      "ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.",
      0,
      "network_error"
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      error?.message ??
        FALLBACK_MESSAGE_BY_STATUS[response.status] ??
        "خطای ناشناخته رخ داد.",
      response.status,
      error?.code ?? "unknown_error"
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<T>("POST", path, { formData });
  },
};

/** Builds a querystring from the params that are actually set. */
export function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

/** The shape every list endpoint returns. */
export interface ListResponse<T> {
  items: T[];
}

/** Joins a profile's name parts the way every screen displays them. */
export function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback = "بدون نام"
): string {
  return [first, last].filter(Boolean).join(" ") || fallback;
}
