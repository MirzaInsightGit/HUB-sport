// services/acs.js
import fetch from "node-fetch";

const { ACS_SERVICE_NAME, ACS_INDEX_NAME, ACS_API_KEY, ACS_API_VERSION } = process.env;

const base = `https://${ACS_SERVICE_NAME}.search.windows.net/indexes/${ACS_INDEX_NAME}`;

export async function acsUpsert(docs) {
  if (!docs?.length) return { upserted: 0 };
  const res = await fetch(`${base}/docs/index?api-version=${ACS_API_VERSION}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": ACS_API_KEY
    },
    body: JSON.stringify({
      value: docs.map(d => ({ ...d, "@search.action": "mergeOrUpload" }))
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ACS upsert fail: ${res.status} ${text}`);
  }
  return res.json();
}