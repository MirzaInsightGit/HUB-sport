import { io } from 'socket.io-client';

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

// REST-bas för chat-relaterade endpoints (users/groups).
// Behåll samma logik som tidigare för att inte påverka annan funktionalitet.
const backendUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8080'
  : 'https://hub.mirzamuhic.com';

// Initiera socket endast om chat är aktiverad. AutoConnect är AV för säkerhets skull
// (vi ansluter manuellt via connectChat() vid behov).
let socket = null;
if (CHAT_ENABLED) {
  socket = io(SOCKET_URL, {
    auth: { token: localStorage.getItem('id_token') },
    transports: ['websocket'],
    autoConnect: false,
  });
}

// Hjälpfunktioner att styra anslutningen manuellt
export const connectChat = () => {
  if (socket && !socket.connected) socket.connect();
};

export const disconnectChat = () => {
  if (socket) socket.disconnect();
};

// No-op helpers när chatten är avstängd
const noop = () => {};
const onNoop = () => noop;

export const sendMessage = (groupId, message) => {
  if (!socket) return; // chat avstängd
  // Skicka bara om vi är anslutna
  if (socket.connected) socket.emit('sendMessage', { groupId, message });
};

export const onReceiveMessage = (callback) => {
  if (!socket) return onNoop; // chat avstängd
  socket.on('receiveMessage', callback);
  return () => socket?.off('receiveMessage', callback);
};

export const onOnlineUsers = (callback) => {
  if (!socket) return onNoop; // chat avstängd
  socket.on('onlineUsers', callback);
  return () => socket?.off('onlineUsers', callback);
};

export const joinGroup = (groupId) => {
  if (!socket || !socket.connected) return; // chat avstängd eller ej ansluten
  socket.emit('joinGroup', groupId);
};

export const fetchUsers = async () => {
  const token = localStorage.getItem('id_token');
  const res = await fetch(`${backendUrl}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let errorData = null;
    try { errorData = await res.json(); } catch {}
    throw new Error(JSON.stringify(errorData) || 'Failed to fetch users');
  }
  return res.json();
};

export const createGroup = async (name, members) => {
  const token = localStorage.getItem('id_token');
  const res = await fetch(`${backendUrl}/groups`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, members }),
  });
  if (!res.ok) {
    let errorData = null;
    try { errorData = await res.json(); } catch {}
    throw new Error(JSON.stringify(errorData) || 'Failed to create group');
  }
  return res.json();
};

export const fetchGroups = async () => {
  const token = localStorage.getItem('id_token');
  const res = await fetch(`${backendUrl}/groups`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let errorData = null;
    try { errorData = await res.json(); } catch {}
    throw new Error(JSON.stringify(errorData) || 'Failed to fetch groups');
  }
  return res.json();
};