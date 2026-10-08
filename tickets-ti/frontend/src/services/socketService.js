import { io } from 'socket.io-client';

let socket = null;

export const initSocket = (token) => {
  if (socket) socket.disconnect();
  // Sin REACT_APP_API_URL se conecta al mismo origen de la página: nginx (o el
  // proxy de desarrollo) lo envía a domain-service.
  socket = io(process.env.REACT_APP_API_URL || undefined, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};
