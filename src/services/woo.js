// services/woo.js
import fetch from "node-fetch";

const { WC_URL, WC_KEY, WC_SECRET } = process.env;

function wcUrl(path, qs="") {
  const auth = `consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;
  return `${WC_URL}/wp-json/wc/v3/${path}?${auth}${qs ? "&"+qs : ""}`;
}

export async function fetchWooOrders({ page=1, perPage=100 }={}) {
  const url = wcUrl("orders", `per_page=${perPage}&page=${page}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Woo orders: ${res.status}`);
  return res.json();
}

export function mapWooOrderToDoc(o) {
  return {
    id: `woo:order:${o.id}`,
    type: "order",
    title: `Order #${o.id}`,
    subtitle: `${o.total} kr • ${o.status}`,
    content: `${o.billing?.first_name || ""} ${o.billing?.last_name || ""} ${o.line_items?.map(li=>li.name).join(", ")}`,
    url: `/admin/orders/${o.id}`,
    tags: ["woo","order", ...(o.line_items||[]).map(li => li.name)],
    orgId: "SBBF",                 // sätt rätt
    season: guessSeasonFromDate(o.date_created),
    createdAt: o.date_created
  };
}

function guessSeasonFromDate(dt) {
  const d = new Date(dt);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth()+1;
  return m >= 7 ? `${y}/${(y+1).toString().slice(-2)}` : `${y-1}/${y.toString().slice(-2)}`;
}