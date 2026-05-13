"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useRoomStore } from "@/stores/roomStore";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const token = useRoomStore((s) => s.token);
  const addToast = useRoomStore((s) => s.addToast);
  const hasShownBackendError = useRef(false);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    // No token → no connection. Clean up any existing socket.
    if (!token) {
      disconnectSocket();
      socketRef.current = null;
      setIsConnected(false);
      hasShownBackendError.current = false;
      reconnectAttemptRef.current = 0;
      return;
    }

    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      hasShownBackendError.current = false;
      reconnectAttemptRef.current = 0;
      console.log("[Socket] Connected");
    };

    const onDisconnect = (reason: string) => {
      setIsConnected(false);
      console.log("[Socket] Disconnected:", reason);
      if (reason === "io server disconnect") {
        addToast("Disconnected from server", "error");
      }
    };

    const onConnectError = (err: Error) => {
      reconnectAttemptRef.current++;
      
      // Auth errors — clear user session immediately
      if (err.message === "Authentication required" || err.message === "Invalid token") {
        useRoomStore.getState().clearUser();
        addToast("Session expired", "error");
        return;
      }

      // Backend unreachable — only show toast once to avoid spam
      if (!hasShownBackendError.current) {
        hasShownBackendError.current = true;
        console.warn("[Socket] Backend unreachable. Will retry in background.", err.message);
        addToast("Server is starting up... retrying", "warning");
      }
    };

    const onReconnect = () => {
      hasShownBackendError.current = false;
      reconnectAttemptRef.current = 0;
      addToast("Reconnected!", "success");
      socket.emit("reconnect:restore");
    };

    const onReconnectFailed = () => {
      console.error("[Socket] All reconnection attempts failed");
      addToast("Cannot reach server. Please check your connection.", "error");
    };

    // Attach listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("reconnect", onReconnect);
    socket.on("reconnect_failed", onReconnectFailed);

    // Now connect (socket was created with autoConnect: false)
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("reconnect", onReconnect);
      socket.off("reconnect_failed", onReconnectFailed);
    };
  }, [token, addToast]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocketContext = () => useContext(SocketContext);
