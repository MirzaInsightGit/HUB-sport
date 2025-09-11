// services/profixio.js
import fetch from "node-fetch";
const { PROFIXIO_BASE_URL, PROFIXIO_API_KEY, REACT_APP_PROFIXIO_ORG } = process.env;

async function px(path, qs="") {
  const res = await fetch(`${PROFIXIO_BASE_URL}/${path}?org=${REACT_APP_PROFIXIO_ORG}${qs ? "&"+qs : ""}`, {
    headers: { "x-api-key": PROFIXIO_API_KEY }
  });
  if (!res.ok) throw new Error(`Profixio ${path}: ${res.status}`);
  return res.json();
}

export async function fetchPlayers() {
  // byt till rätt endpoint ni använder idag
  return px("players");
}

export function mapPxPlayerToDoc(p) {
  return {
    id: `profixio:player:${p.id}`,
    type: "player",
    title: `${p.firstName} ${p.lastName}`,
    subtitle: `${p.clubName || ""} • ${p.position || ""}`,
    content: `${p.gender || ""} ${p.birthYear || ""} ${p.team || ""} ${p.notes || ""}`,
    url: `/admin/players/${p.id}`,
    tags: ["profixio","player", p.gender, p.position].filter(Boolean),
    orgId: "SBBF",
    season: p.season || "",
    createdAt: p.createdAt || new Date().toISOString()
  };
}