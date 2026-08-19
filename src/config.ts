const rawStreamApiUrl = import.meta.env.VITE_STREAM_API_URL || 'http://localhost:3001';

export const STREAM_API_URL = String(rawStreamApiUrl).replace(/\/+$/, '');

export const IS_STANDALONE = true;
