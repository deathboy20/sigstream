import { io } from 'socket.io-client';
import { STREAM_API_URL } from '../config';

export const conferenceSocket = io(STREAM_API_URL, {
  autoConnect: true
});
