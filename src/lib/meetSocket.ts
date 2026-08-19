import { io, Socket } from 'socket.io-client';
import { STREAM_API_URL } from '../config';

export const socket: Socket = io(STREAM_API_URL, {
  autoConnect: false,
  reconnection: false,
  transports: ['websocket', 'polling'],
});

export const setSocketAuthToken = (token: string | null) => {
  socket.auth = token ? { token } : {};
};

export const connectMeetSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectMeetSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
