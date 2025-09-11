// src/api/searchClient.js
const API_BASE = process.env.REACT_APP_API_BASE || "/api";

export async function searchPortal({ q, top = 20, type, filters, skip = 0 }) {
  // Din backend har GET /api/search i dagsläget.
  // Vill du byta till POST (med facets, filter etc.), säg till – jag ger patch.
  const params = new URLSearchParams();
  params.set("q", q || "*");
  if (top) params.set("top", String(top));
  if (type) params.set("type", String(type));

  const res = await fetch(`${API_BASE}/search?${params.toString()}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
}

export async function suggestPortal(q, { top = 8 } = {}) {
  const res = await fetch(
    `${API_BASE}/search/suggest?q=${encodeURIComponent(q || "")}&top=${top}`,
    { headers: { "Accept": "application/json" } }
  );
  if (!res.ok) throw new Error(`Suggest failed (${res.status})`);
  return res.json(); // ACS-format: { value: [ { text, ... }, ... ] }
}