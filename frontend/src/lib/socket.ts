"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let currentToken: string | null = null;

export const getSocket = (token: string): Socket => {
  // If token changed, tear down old socket completely
  if (socket && currentToken !== token) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  // Return existing socket if it's still alive (connected or reconnecting)
  if (socket) return socket;

  currentToken = token;

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", {
    auth: { token },
    autoConnect: false, // We'll connect manually after attaching listeners
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
    transports: ["websocket", "polling"], // Prefer WebSocket, fallback to polling
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};

export const getExistingSocket = (): Socket | null => socket;
