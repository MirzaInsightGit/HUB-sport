import axios from 'axios';
import { io } from 'socket.io-client';

// Lightweight logger
const log = (...args) => (process.env.NODE_ENV !== 'production' ? console.debug('[chatService]', ...args) : undefined);

// --- Chat helpers ---
const getUserId = (u) => u?.oid || u?.sub || u?.id || u?.objectId || u?.preferred_username || u?.upn || u?.name || 'guest';

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
  // Realtime emit first (if possible)
  try { if (socket?.connected) socket.emit('message:send', { groupId, message }); } catch {}
  // Persist (also enables email fallback server-side)
  try {
    const { data } = await axios.post(`${CHAT_API}/groups/${groupId}/messages`, { message });
    return data; // expect saved message or { ok: true }
  } catch (e) {
    log('sendMessage REST failed', e?.response?.status || e?.message);
    throw e;
  }
};

export const onReceiveMessage = (callback) => {
  if (!socket) return onNoop; // chat avstängd
  const handler = (payload) => callback(payload);
  socket.off('receiveMessage', handler);
  socket.off('message:new', handler);
  socket.on('receiveMessage', handler); // legacy
  socket.on('message:new', handler);    // preferred
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
      const { data } = await axios.get(p);
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

export const createGroup = async (name, members) => {
  const body = { name, members };
  try {
    const { data } = await axios.post(`${CHAT_API}/groups`, body);
    return data;
  } catch {
    const { data } = await axios.post(`${API_BASE}/groups`, body);
    return data;
  }
};

export const fetchGroups = async () => {
  const paths = [`${CHAT_API}/groups`, `${API_BASE}/groups`];
  let lastErr;
  for (const p of paths) {
    try {
      const { data } = await axios.get(p);
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

export const isChatEnabled = () => !!socket;
export const getSocketState = () => ({ enabled: !!socket, connected: !!socket?.connected, url: SOCKET_URL });