// src/utils/auth.js
export function getMyClaims() {
  const raw = localStorage.getItem('id_token') || localStorage.getItem('access_token');
  if (!raw) return {};
  const [, payload] = raw.split('.');
  try { return JSON.parse(atob(payload)); } catch { return {}; }
}

export function getMyOid() {
  const c = getMyClaims();
  return c.oid || c.sub || c.id || c.objectId || c.upn || c.preferred_username || '';
}

export function getMyDisplayName() {
  const c = getMyClaims();
  return c.name || c.given_name || c.preferred_username || c.upn || 'Me';
}