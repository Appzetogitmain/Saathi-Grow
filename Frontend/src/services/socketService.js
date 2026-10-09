import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/apiConfig';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const rawUrl = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
    const socketUrl = rawUrl.replace(/\/api\/?$/, '');

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('⚡ Socket connected to backend:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔥 Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('⚠️ Socket connection error:', error.message);
    });
  }
  return socket;
};

export const subscribeToEvent = (event, callback) => {
  const s = getSocket();
  s.on(event, callback);
  return () => {
    s.off(event, callback);
  };
};

export default { getSocket, subscribeToEvent };
