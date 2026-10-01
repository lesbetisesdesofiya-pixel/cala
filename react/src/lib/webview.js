// Détection navigateur intégré (TikTok et cie) + sortie vers vrai navigateur.
// Contexte : en webview TikTok, (1) l'installation PWA est impossible
// (pas de beforeinstallprompt, manifest ignoré), (2) le retour MoneyFusion
// ou la session peuvent changer de contexte -> d'où les secours serveur
// (ref retrouvé côté serveur) et cette bannière de sortie.
export function isTikTok() {
  try {
    return /tiktok|musical_ly|bytedance|aweme/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}

export function isAndroid() {
  try {
    return /android/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}

// Tente d'ouvrir l'URL courante dans Chrome (Android). iOS : impossible de
// forcer -> false, afficher la consigne (··· → Ouvrir dans Safari).
export function openExternal() {
  try {
    if (!isAndroid()) return false;
    const sansProto = window.location.href.replace(/^https?:\/\//, "");
    window.location.href = `intent://${sansProto}#Intent;scheme=https;package=com.android.chrome;end`;
    return true;
  } catch {
    return false;
  }
}
