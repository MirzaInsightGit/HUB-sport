// services/db.js
import { Pool } from "pg"; // eller mysql2, beroende på vad ni kör
const pool = new Pool({ connectionString: process.env.DB_URL });

export async function fetchClubs() {
  const { rows } = await pool.query(
    `select id, name, city, org_id as "orgId", created_at as "createdAt" from clubs`
  );
  return rows;
}
export function mapClubToDoc(c) {
  return {
    id: `db:club:${c.id}`,
    type: "club",
    title: c.name,
    subtitle: c.city || "",
    content: `${c.name} ${c.city || ""}`,
    url: `/admin/clubs/${c.id}`,
    tags: ["club", c.city].filter(Boolean),
    orgId: c.orgId || "SBBF",
    season: "",
    createdAt: c.createdAt || new Date().toISOString()
  };
}