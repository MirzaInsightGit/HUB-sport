 // src/config/apiBase.js
 // Använd env-variabel om den finns, annars hårdkodad absolut URL
 const fromEnv =
   (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
   (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE);

 const fallback = "https://stockholmbasket-express-api-avf6ayfkdnc3b6gn.centralus-01.azurewebsites.net/api";

 export const API_BASE = (fromEnv || fallback).replace(/\/+$/, "");