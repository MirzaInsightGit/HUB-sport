import React from 'react';
import { useMsal } from '@azure/msal-react';
import { Navigate } from 'react-router-dom';

/**
 * RoleGuard
 * - Kollar roller från ID-token (claims.roles)
 * - Faller tillbaka till gruppmedlemskap (claims.groups) och mappar till roller via env
 *   REACT_APP_ADMIN_GROUP_IDS, REACT_APP_COACH_GROUP_IDS, REACT_APP_DOMARE_GROUP_IDS, REACT_APP_PERSONAL_GROUP_IDS
 *   (komma-separerade GUID:er)
 *
 * Ingen nätverksanrop, ingen token-hämtning – endast redan-inlästa claims via MSAL.
 */
export default function RoleGuard({ allow = [], redirect = '/admin/hub', children }) {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() || accounts?.[0] || null;

  // Inte inloggad? Navigera bort.
  if (!account) return <Navigate to={redirect} replace />;

  const claims = account.idTokenClaims || {};
  const claimRoles = Array.isArray(claims.roles) ? claims.roles.map(String) : [];
  const claimGroups = Array.isArray(claims.groups) ? claims.groups.map(String) : [];

  // Läs groupIDs från env (komma-separerade)
  const envList = (name) => (process.env[name] || '').split(',').map(s => s.trim()).filter(Boolean);
  const ADMIN = new Set(envList('REACT_APP_ADMIN_GROUP_IDS'));
  const COACH = new Set(envList('REACT_APP_COACH_GROUP_IDS'));
  const DOMARE = new Set(envList('REACT_APP_DOMARE_GROUP_IDS'));
  const PERSONAL = new Set(envList('REACT_APP_PERSONAL_GROUP_IDS'));

  // Mappar grupper -> roller
  const groupDerivedRoles = new Set();
  for (const g of claimGroups) {
    if (ADMIN.has(g)) groupDerivedRoles.add('admin');
    if (COACH.has(g)) groupDerivedRoles.add('coach');
    if (DOMARE.has(g)) groupDerivedRoles.add('domare');
    if (PERSONAL.has(g)) groupDerivedRoles.add('personal');
  }

  // Effektiva roller = token-roller ⊔ gruppbaserade roller
  const roles = new Set([...(claimRoles || []), ...groupDerivedRoles]);

  // Om ingen allow specificerad, släpp igenom alla inloggade
  if (!allow.length) return children;

  // Tillåten om någon av allow finns i effektiva roller
  const permitted = allow.some(r => roles.has(r));
  return permitted ? children : <Navigate to={redirect} replace />;
}