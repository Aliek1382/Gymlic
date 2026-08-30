/**
 * beforeinstallprompt is Chromium-only and absent from lib.dom, so the pieces
 * the install prompt relies on are declared here.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  appinstalled: Event;
  /** Dispatched by the capture script in the root layout. */
  "gymlic:installavailable": Event;
}

interface Window {
  /**
   * Where the root layout's inline script parks the deferred install event,
   * because Chrome fires it once and usually before React has hydrated.
   */
  __gymlicInstallPrompt: BeforeInstallPromptEvent | null;
}
