// src/config/apiBase.js

// Läs bas-URL från env, fallback till /api (proxy i dev)
const raw =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  "/api";

// Ta bort ev. avslutande slash
export const API_BASE = String(raw).replace(/\/+$/, "");