import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

/** Singleton Socket.IO client for the admin dashboard — connects to the same
 * backend origin api.ts already talks to (VITE_API_URL, no /api/v1 suffix;
 * the Socket.IO server in server.ts is mounted on the bare HTTP server, not
 * under that path prefix). Lazily created on first getSocket() call, not at
 * module load — most pages never need a live connection at all. */
let socket: Socket | null = null;

function baseUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
}

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(baseUrl(), {
    auth: { token: useAuthStore.getState().token },
    autoConnect: true,
  });

  // A staff session can outlive its original 15-minute access token many
  // times over via silent refresh (see api.ts's own 401 interceptor) — the
  // socket's own JWT is checked once, at connect/reconnect time, so without
  // this a long-lived dashboard tab would eventually fail reconnection with
  // a stale, expired token after any disconnect (network blip, server
  // restart). Re-point `socket.auth` on every token change so the NEXT
  // reconnect attempt always carries the current token.
  useAuthStore.subscribe((state) => {
    if (socket) socket.auth = { token: state.token };
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
