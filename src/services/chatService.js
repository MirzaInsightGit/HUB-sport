import { io } from 'socket.io-client';

const backendUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : 'https://hub.mirzamuhic.com';

const socket = io(backendUrl, {
  auth: {
    token: localStorage.getItem('id_token')
  },
  transports: ['websocket']
});

export const sendMessage = (groupId, message) => {
  socket.emit('sendMessage', { groupId, message });
};

export const onReceiveMessage = (callback) => {
  socket.on('receiveMessage', callback);
};

export const onOnlineUsers = (callback) => {
  socket.on('onlineUsers', callback);
};

export const joinGroup = (groupId) => {
  socket.emit('joinGroup', groupId);
};

export const fetchUsers = async () => {
  const token = localStorage.getItem('id_token');
  const res = await fetch(`${backendUrl}/api/users`, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(JSON.stringify(errorData) || 'Failed to fetch users');
  }
  return res.json();
};

export const createGroup = async (name, members) => {
  const token = localStorage.getItem('id_token');
  const res = await fetch(`${backendUrl}/api/groups`, { 
    method: 'POST', 
    headers: { 
      Authorization: `Bearer ${token}`, 
      'Content-Type': 'application/json' 
    }, 
    body: JSON.stringify({ name, members }) 
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(JSON.stringify(errorData) || 'Failed to create group');
  }
  return res.json();
};

export const fetchGroups = async () => {
  const token = localStorage.getItem('id_token');
  const res = await fetch(`${backendUrl}/api/groups`, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(JSON.stringify(errorData) || 'Failed to fetch groups');
  }
  return res.json();
};