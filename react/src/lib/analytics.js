// PostHog — helpers d'analytics. L'init SDK est faite par <PostHogProvider>
// dans main.jsx (env VITE_POSTHOG_*). Ici : capture d'erreurs + petits
// raccourcis. Jamais de nom, téléphone, PIN, note ou intitulé libre.
import posthog from "posthog-js";

let errHook = false;

export function initAnalytics() {
  if (errHook || typeof window === "undefined") return;
  errHook = true;
  try {
    window.addEventListener("error", (e) => {
      try { posthog.captureException?.(e.error || new Error(e.message)); } catch {}
    });
    window.addEventListener("unhandledrejection", (e) => {
      try { posthog.captureException?.(e.reason); } catch {}
    });
  } catch {}
}

export function track(event, props) {
  try { posthog.capture(event, props); } catch {}
}

// HashRouter : la route est dans le #, pas dans pathname — capture manuelle.
export function capturePageview(url) {
  try { posthog.capture("$pageview", { $current_url: url }); } catch {}
}

export function identify(userId, props) {
  try { posthog.identify(userId, props); } catch {}
}

export function resetIdentity() {
  try { posthog.reset(); } catch {}
}
