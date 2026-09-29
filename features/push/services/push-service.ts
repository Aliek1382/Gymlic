import { api } from "@/lib/api/client";

export type PushStatus = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function supportsPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** What the toggle should offer on this device right now. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!supportsPush()) {
    // iOS only exposes push to an app installed on the home screen.
    return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";

  const subscription = await currentSubscription();
  if (!subscription) return "off";

  // Re-register on every look: it is idempotent, and it moves this browser to
  // whoever is signed in now (see PushController::subscribe).
  await sendSubscription(subscription).catch(() => undefined);
  return "on";
}

function toKey(base64Url: string): ArrayBuffer {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const raw = atob(padded);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

async function sendSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await api.post("/push/subscriptions", { endpoint: json.endpoint, keys: json.keys });
}

export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("اجازهٔ اعلان داده نشد. از تنظیمات مرورگر اجازه را فعال کنید.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKey((await api.get<{ public_key: string }>("/push/public-key")).public_key),
    }));

  await sendSubscription(subscription);
}

export async function disablePush(): Promise<void> {
  await removeCurrentDeviceSubscription();
}

/** Drops this browser's subscription on the server and in the browser. Best effort; never throws. */
export async function removeCurrentDeviceSubscription(): Promise<void> {
  try {
    if (!supportsPush()) return;
    const subscription = await currentSubscription();
    if (!subscription) return;

    await api.post("/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe();
  } catch {
    // Signing out or switching off must not fail because of push.
  }
}

/** Asks the server to push a test message to the signed-in user's devices. */
export async function sendTestPush(): Promise<void> {
  await api.post("/push/test");
}
