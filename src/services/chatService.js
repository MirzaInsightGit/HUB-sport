import axios from 'axios';
import { io } from 'socket.io-client';
import { getMyOid, getMyDisplayName } from '../utils/auth';

// Lightweight logger (no-op in production)
const log = (...args) => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return;
    // eslint-disable-next-line no-console
    console.log('[chat]', ...args);
  } catch {}
};

// --- MSAL-safe token/claims helpers (robusta mot olika cacheformat) ---
function b64Decode(payload) {
  try {
    const s = payload.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(s).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
  } catch { return ''; }
}

function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return {};
    const json = b64Decode(part);
    return JSON.parse(json || '{}');
  } catch { return {}; }
}

function readFromStore(store, credentialType) {
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (!k) continue;
      if (!/^[\w.\-:]+$/.test(k)) continue;
      const raw = store.getItem(k);
      if (!raw) continue;
      if (raw[0] !== '{' && raw[0] !== '[') continue;

      let obj;
      try { obj = JSON.parse(raw); } catch { continue; }

      // Direct MSAL credential object
      if (obj && typeof obj === 'object' && obj.credentialType && obj.secret) {
        if (String(obj.credentialType).toLowerCase() === String(credentialType).toLowerCase()) {
          return obj.secret;
        }
      }

      // MSAL "token keys" list that points to other keys
      if (Array.isArray(obj) && obj.length && String(credentialType).toLowerCase() === 'idtoken') {
        for (const refKey of obj) {
          try {
            const v = store.getItem(refKey);
            const vo = v && v[0] === '{' ? JSON.parse(v) : null;
            if (vo && vo.credentialType && vo.secret && String(vo.credentialType).toLowerCase() === 'idtoken') {
              return vo.secret;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return '';
}

function readMsalToken(credentialType) {
  // Prefer sessionStorage (MSAL default), then localStorage as fallback
  if (typeof sessionStorage !== 'undefined') {
    const hit = readFromStore(sessionStorage, credentialType);
    if (hit) return hit;
  }
  if (typeof localStorage !== 'undefined') {
    const hit = readFromStore(localStorage, credentialType);
    if (hit) return hit;
  }
  return '';
}

function getIdToken() {
  const msalId = readMsalToken('IdToken');
  if (msalId) return msalId;
  const fromLocal = localStorage.getItem('id_token');
  if (fromLocal) return fromLocal;
  return '';
}

function getAccessToken() {
  const msalAcc = readMsalToken('AccessToken');
  if (msalAcc) return msalAcc;
  const fromLocal = localStorage.getItem('access_token');
  if (fromLocal) return fromLocal;
  return '';
}

function getClaims() {
  const id = getIdToken();
  if (!id) return {};
  return decodeJwt(id) || {};
}

function getNameFromClaims(c) {
  return (
    c.name ||
    (c.given_name && c.family_name ? `${c.given_name} ${c.family_name}`.trim() : '') ||
    c.preferred_username ||
    c.upn ||
    ''
  );
}

const getToken = () => getAccessToken() || getIdToken() || '';

const _claims = getClaims();
const ME = {
  oid: (_claims.oid || _claims.sub || _claims.objectId || (getMyOid && getMyOid())) || '',
  name: (getNameFromClaims(_claims) || (getMyDisplayName && getMyDisplayName())) || ''
};

const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// Keep a short-lived cache of messages we sent (to help right-align history while backend rollout settles)
const SENT_CACHE = [];
const rememberSent = (m) => {
  try {
    SENT_CACHE.push({ text: m.text, groupId: m.groupId, ts: Date.now() });
    // keep last 100 and max 5 minutes old
    const cutoff = Date.now() - 5 * 60 * 1000;
    while (SENT_CACHE.length > 100 || (SENT_CACHE[0] && SENT_CACHE[0].ts < cutoff)) SENT_CACHE.shift();
  } catch {}
};

// --- Chat helpers ---

// Normalizers
const normalizeUsers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.value)) return data.value; // OData-ish
  return [];
};
const normalizeGroups = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.groups)) return data.groups;
  if (Array.isArray(data?.value)) return data.value;
  return [];
};

const normalizeMessage = (m = {}) => {
  const msg = {
    id: m.id || m._id || m.messageId || `msg_${Date.now()}`,
    groupId: m.groupId || m.group_id || m.grp || m.group || '',
    text: m.text ?? m.message ?? m.body ?? '',
    ts: m.ts || m.timestamp || m.createdAt || new Date().toISOString(),
    type: m.type || 'message',
    senderId: m.senderId || m.userId || m.sender || m.createdBy || m.oid || m.user_oid || '',
    senderName: m.senderName || m.userName || m.name || m.displayName || '',
    raw: m,
  };
  // Primary: compare OID
  let isMe =
    !!ME.oid &&
    !!msg.senderId &&
    String(msg.senderId).toLowerCase() === String(ME.oid).toLowerCase();

  // Fallback: compare display name if OID missing but name matches
  if (!isMe && ME.name && msg.senderName) {
    isMe = String(msg.senderName).toLowerCase() === String(ME.name).toLowerCase();
  }

  // Heuristic fallback: if backend lacked senderId/name, check if this text was just sent by this client
  if (!isMe && (!msg.senderId || !msg.senderName)) {
    const recent = SENT_CACHE.find(
      (r) => r.groupId === msg.groupId && r.text === msg.text && Date.now() - r.ts < 5 * 60 * 1000
    );
    if (recent) isMe = true;
  }

  msg.isMe = !!isMe;

  // Ensure my own messages show my name
  if (msg.isMe && !msg.senderName) msg.senderName = ME.name || 'Me';

  return msg;
};

// === Chat/WebSocket toggle ==============================================
// Sätt VITE_SOCKET_ENABLED=true i miljön för att slå PÅ chatten.
// Default = AV (ingen anslutning görs och inga WS-anrop sker).
const CHAT_ENABLED =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    String(import.meta.env.VITE_SOCKET_ENABLED).toLowerCase() === 'true');

// URL för socket-servern (separat från API-bas-URL)
const SOCKET_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_SOCKET)) ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:8080'
    : 'https://hub.mirzamuhic.com');

// REST-bas för chat-relaterade endpoints (users/groups). Använd axios + global interceptor
// så rätt token (API access.read) sätts automatiskt.
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  || process.env.REACT_APP_API_BASE
  || '/api';

// Prefer /api/chat/* if it exists in your backend, fall back to /api/*
const CHAT_API = `${API_BASE}/chat`;

// Initiera socket endast om chat är aktiverad. AutoConnect är AV för säkerhets skull
// (vi ansluter manuellt via connectChat() vid behov).
let socket = null;
if (CHAT_ENABLED) {
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: false,
    path: '/socket.io',
    auth: { token: getToken() },
    query: { oid: ME.oid, name: ME.name }
  });
}

// Hjälpfunktioner att styra anslutningen manuellt
export const connectChat = () => {
  if (!CHAT_ENABLED) { log('socket disabled via env'); return; }
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
      path: '/socket.io',
      auth: { token: getToken() },
      query: { oid: ME.oid, name: ME.name }
    });
  }
  if (!socket.connected) {
    log('connecting to socket', SOCKET_URL);
    socket.connect();
  }
  return socket;
};

export const disconnectChat = () => {
  if (socket) socket.disconnect();
};

// No-op helpers när chatten är avstängd
const noop = () => {};
const onNoop = () => noop;

export const sendMessage = async (groupId, message) => {
  if (!groupId || !message) return;
  const body = { message, senderId: ME.oid, senderName: ME.name };

  // optimistic local echo + heuristic cache
  const optimistic = normalizeMessage({
    id: `msg_${Date.now()}`,
    groupId,
    text: message,
    ts: new Date().toISOString(),
    type: 'message',
    senderId: ME.oid,
    senderName: ME.name,
  });
  rememberSent(optimistic);

  // Emit first for realtime
  try {
    if (socket?.connected) {
      socket.emit('message:send', {
        groupId,
        message,
        senderId: ME.oid,
        senderName: ME.name,
      });
    }
  } catch {}

  try {
    const { data } = await axios.post(`${CHAT_API}/groups/${groupId}/messages`, body, { headers: authHeaders() });
    // Server returns either `{ ok: true }` or a full message; normalize both
    const normalized = Array.isArray(data) ? data.map(normalizeMessage) : normalizeMessage(data);
    return normalized || optimistic;
  } catch (e) {
    log('sendMessage REST failed', e?.response?.status || e?.message);
    // fall back to optimistic so UI still shows something
    return optimistic;
  }
};

export const onReceiveMessage = (callback) => {
  if (!socket) return onNoop;
  const handler = (payload) => callback(normalizeMessage(payload));
  socket.off('receiveMessage', handler);
  socket.off('message:new', handler);
  socket.on('receiveMessage', handler);
  socket.on('message:new', handler);
  return () => {
    socket?.off('receiveMessage', handler);
    socket?.off('message:new', handler);
  };
};

export const onOnlineUsers = (callback) => {
  if (!socket) return onNoop; // chat avstängd
  socket.on('onlineUsers', callback);
  return () => socket?.off('onlineUsers', callback);
};

export const joinGroup = (groupId) => {
  if (!socket) return; // chat avstängd
  const doJoin = () => socket.emit('joinGroup', groupId);
  if (!socket.connected) {
    connectChat();
    socket.once('connect', doJoin);
  } else {
    doJoin();
  }
};

export const fetchUsers = async () => {
  // Try /api/chat/users first, then /api/users
  const paths = [`${CHAT_API}/users`, `${API_BASE}/users`];
  let lastErr;
  for (const p of paths) {
    try {
      const { data } = await axios.get(p, { headers: authHeaders() });
      const users = normalizeUsers(data);
      if (users.length || Array.isArray(data)) {
        log('users from', p, users.length);
        return users;
      }
    } catch (e) { lastErr = e; log('fetchUsers failed on', p, e?.response?.status || e?.message); }
  }
  if (lastErr) throw lastErr;
  return [];
};

// Alias: semantic name used by UI components
export const listChatUsers = fetchUsers;

export const createGroup = async (name, members = []) => {
  // Always include the current user (ME.oid) in the group
  const normalizedMembers = Array.from(new Set([ME.oid, ...members.filter(Boolean)]));
  const body = { name, members: normalizedMembers,createdBy: ME.oid,createdByName: ME.name };
  try {
    const { data } = await axios.post(`${CHAT_API}/groups`, body, { headers: authHeaders() });
    return data;
  } catch {
    const { data } = await axios.post(`${API_BASE}/groups`, body, { headers: authHeaders() });
    return data;
  }
};

// Update group name + full members array (ADMIN)
export const updateGroup = async (groupId, { name, members }) => {
  const body = {};
  if (typeof name === 'string') body.name = name;
  if (Array.isArray(members)) body.members = members;
  const { data } = await axios.put(`${CHAT_API}/groups/${encodeURIComponent(groupId)}`, body, { headers: authHeaders() });
  return data;
};

// Patch only members (ADMIN) – add/remove arrays
export const patchGroupMembers = async (groupId, { add = [], remove = [] } = {}) => {
  const body = { add, remove };
  const { data } = await axios.post(`${CHAT_API}/groups/${encodeURIComponent(groupId)}/members`, body, { headers: authHeaders() });
  return data;
};

// Soft delete group (ADMIN or creator)
export const deleteGroup = async (groupId) => {
  const { data } = await axios.delete(`${CHAT_API}/groups/${encodeURIComponent(groupId)}`, { headers: authHeaders() });
  return data;
};

export const fetchGroups = async () => {
  const paths = [`${CHAT_API}/groups`, `${API_BASE}/groups`];
  let lastErr;
  for (const p of paths) {
    try {
      const { data } = await axios.get(p, { headers: authHeaders() });
      const groups = normalizeGroups(data);
      if (groups.length || Array.isArray(data)) {
        log('groups from', p, groups.length);
        return groups;
      }
    } catch (e) { lastErr = e; log('fetchGroups failed on', p, e?.response?.status || e?.message); }
  }
  if (lastErr) throw lastErr;
  return [];
};

// Alias for semantic name
export const listGroups = fetchGroups;

// Fetch messages for a given groupId, with fallback and error logging
export const fetchMessages = async (groupId) => {
  if (!groupId) return [];
  const paths = [
    `${CHAT_API}/groups/${groupId}/messages?limit=50`,
    `${API_BASE}/groups/${groupId}/messages?limit=50`
  ];
  for (const p of paths) {
    try {
      const { data } = await axios.get(p, { headers: authHeaders() });
      if (Array.isArray(data)) {
        log('messages from', p, data.length);
        return data.map(normalizeMessage);
      }
      if (Array.isArray(data?.messages)) {
        log('messages from', p, data.messages.length);
        return data.messages.map(normalizeMessage);
      }
      if (Array.isArray(data?.value)) {
        log('messages from', p, data.value.length);
        return data.value.map(normalizeMessage);
      }
    } catch (e) {
      log('fetchMessages failed on', p, e?.response?.status || e?.message);
    }
  }
  // No throw, just return []
  return [];
};

// Alias for semantic name
export const listMessages = fetchMessages;

// Admin broadcast (email notifications)
export const broadcastMail = async ({ audience = 'all', subject, message }) => {
  const body = { audience, subject, message };
  const { data } = await axios.post(`${API_BASE}/chat/broadcast`, body, { headers: authHeaders() });
  return data;
};

export const isChatEnabled = () => !!socket;
export const getSocketState = () => ({ enabled: !!socket, connected: !!socket?.connected, url: SOCKET_URL });

export const _normalizeMessage = normalizeMessage;