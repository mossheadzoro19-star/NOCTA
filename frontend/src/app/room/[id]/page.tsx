"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useSocket } from "@/hooks/useSocket";
import { useRoomStore } from "@/stores/roomStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { apiRequest } from "@/lib/utils";
import dynamic from "next/dynamic";
const VideoPlayer = dynamic(() => import("@/components/room/VideoPlayer"), {
  ssr: false,
});
import ChatSidebar from "@/components/room/ChatSidebar";
import RoomControls from "@/components/room/RoomControls";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import DiagnosticsOverlay from "@/components/room/DiagnosticsOverlay";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const user = useRoomStore((s) => s.user);
  const token = useRoomStore((s) => s.token);
  const roomCode = useRoomStore((s) => s.roomCode);
  const setUser = useRoomStore((s) => s.setUser);
  const setMessages = useRoomStore((s) => s.setMessages);
  const recoverSession = useRoomStore((s) => s.recoverSession);
  const setAuthModalOpen = useRoomStore((s) => s.setAuthModalOpen);
  const { joinRoom, isConnected } = useSocket();
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  const [joining, setJoining] = useState(true);

  // Recover session on mount
  useEffect(() => {
    recoverSession();
  }, [recoverSession]);

  useEffect(() => {
    if (!user || !token) {
      setAuthModalOpen(true);
      setJoining(false);
      return;
    }
    if (!isConnected) return;
    if (roomCode === roomId.toUpperCase()) {
      setJoining(false);
      return;
    }

    const initRoom = async () => {
      try {
        const msgData = await apiRequest(`/api/rooms/${roomId}/messages`);
        if (msgData.messages) setMessages(msgData.messages);
      } catch {}
      joinRoom(roomId);
      setJoining(false);
    };
    initRoom();
  }, [user, token, isConnected, roomId, roomCode, joinRoom, setMessages, setAuthModalOpen]);

  // Auth gate - redirect if they still refuse to auth
  if (!user && !joining) {
    return (
      <main className="min-h-screen bg-nocta-bg flex flex-col items-center justify-center p-6 text-center">
        <div className="ambient-glow" />
        <h1 className="text-[24px] font-bold text-nocta-text mb-2">Authentication Required</h1>
        <p className="text-[16px] text-nocta-text-secondary mb-8 max-w-sm">
          Please sign in to join room <span className="font-mono text-nocta-accent">{roomId.toUpperCase()}</span>
        </p>
        <Button size="lg" onClick={() => setAuthModalOpen(true)}>
          Sign In
        </Button>
      </main>
    );
  }

  // Loading
  if (joining) {
    return (
      <main className="min-h-screen bg-nocta-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-nocta-border border-t-nocta-accent rounded-full animate-spin" />
      </main>
    );
  }

  // Room
  return (
    <main className="h-screen bg-nocta-bg flex flex-col overflow-hidden relative">
      <div className="ambient-glow-room" />
      <DiagnosticsOverlay />
      <div className="flex-1 flex overflow-hidden relative z-10 pt-16"> {/* Add padding for Navbar if needed */}
        <VideoPlayer />
        <ChatSidebar />
      </div>
      <RoomControls />

      <Modal isOpen={showHelp} onClose={() => setShowHelp(false)}>
        <div>
          <h2 className="text-[22px] font-bold text-nocta-text mb-4">Keyboard Shortcuts</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-[14px] text-nocta-text-muted"><span>Play / Pause</span><kbd className="font-mono bg-white/10 px-2 py-1 rounded">Space</kbd></div>
            <div className="flex justify-between text-[14px] text-nocta-text-muted"><span>Seek Backward 10s</span><kbd className="font-mono bg-white/10 px-2 py-1 rounded">J</kbd></div>
            <div className="flex justify-between text-[14px] text-nocta-text-muted"><span>Seek Forward 10s</span><kbd className="font-mono bg-white/10 px-2 py-1 rounded">L</kbd></div>
            <div className="flex justify-between text-[14px] text-nocta-text-muted"><span>Toggle Fullscreen</span><kbd className="font-mono bg-white/10 px-2 py-1 rounded">F</kbd></div>
            <div className="flex justify-between text-[14px] text-nocta-text-muted"><span>Toggle Mute</span><kbd className="font-mono bg-white/10 px-2 py-1 rounded">M</kbd></div>
            <div className="flex justify-between text-[14px] text-nocta-text-muted"><span>Toggle Chat</span><kbd className="font-mono bg-white/10 px-2 py-1 rounded">C</kbd></div>
            <div className="flex justify-between text-[14px] text-nocta-text-muted"><span>Exit Fullscreen / Close Chat</span><kbd className="font-mono bg-white/10 px-2 py-1 rounded">Esc</kbd></div>
            <div className="flex justify-between text-[14px] text-nocta-text-muted"><span>Show Shortcuts</span><kbd className="font-mono bg-white/10 px-2 py-1 rounded">?</kbd></div>
          </div>
          <Button variant="primary" className="w-full mt-6" onClick={() => setShowHelp(false)}>Close</Button>
        </div>
      </Modal>
    </main>
  );
}
