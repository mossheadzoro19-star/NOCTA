"use client";

import { useEffect } from "react";
import { SocketProvider } from "@/context/SocketProvider";
import Toast from "@/components/ui/Toast";
import ReactionOverlay from "@/components/room/ReactionOverlay";
import { useRoomStore } from "@/stores/roomStore";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hydrate user from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("nocta_token");
    const userStr = localStorage.getItem("nocta_user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        useRoomStore.getState().setUser(user, token);
      } catch {
        localStorage.removeItem("nocta_token");
        localStorage.removeItem("nocta_user");
      }
    }
  }, []);

  return (
    <SocketProvider>
      {children}
      <Toast />
      <ReactionOverlay />
    </SocketProvider>
  );
}
