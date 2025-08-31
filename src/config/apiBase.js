// src/config/apiBase.js

// 1) Tillåt override via env (Vite eller CRA)
const ENV_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_API_BASE);

// 2) Standardbaser
const PROD_FALLBACK =
  "https://stockholmbasket-express-api-avf6ayfkdnc3b6gn.centralus-01.azurewebsites.net/api";
const DEV_FALLBACK = "http://localhost:8080/api";

// Hjälpare
const getHost = () =>
  typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost = (h) => /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(h);
const stripTrailing = (s) => String(s || "").replace(/\/+$/, "");

// 3) Välj bas utan att störa produktion
function pickBase() {
  // Env-override vinner alltid
  if (ENV_BASE) return ENV_BASE;

  const host = getHost();
  // Lokalt dev → prata direkt med Express-API
  if (isLocalHost(host)) return DEV_FALLBACK;

  // Allt annat (verkliga huben, andra domäner) → Azure-API
  return PROD_FALLBACK;
}

export const API_BASE = stripTrailing(pickBase());