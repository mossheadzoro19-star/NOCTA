"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "@/stores/roomStore";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useRouter } from "next/navigation";
import ParticipantList from "./ParticipantList";

const REACTIONS = ["❤️", "😂", "🔥", "👏", "😮"];

export default function RoomControls() {
  const router = useRouter();
  const { sendReaction, leaveRoom } = useSocket();
  const { startScreenShare, stopScreenShare, isSharing } = useWebRTC();
  const roomCode = useRoomStore((s) => s.roomCode);
  const roomName = useRoomStore((s) => s.roomName);
  const toggleChat = useRoomStore((s) => s.toggleChat);
  const isChatOpen = useRoomStore((s) => s.isChatOpen);
  const unreadCount = useRoomStore((s) => s.unreadCount);
  const addToast = useRoomStore((s) => s.addToast);

  const [showReactions, setShowReactions] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room/${roomCode}`
      );
      setCopied(true);
      addToast("Link copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("Failed to copy", "error");
    }
  };

  const handleLeave = () => {
    leaveRoom();
    router.push("/");
  };

  return (
    <div className="h-14 sm:h-16 bg-nocta-bg border-b border-nocta-border px-3 sm:px-6 flex items-center justify-between relative z-10">
      {/* Left */}
      <div className="flex items-center gap-2 sm:gap-4 overflow-hidden mr-2">
        <span className="text-[15px] sm:text-[18px] font-bold text-nocta-text tracking-[-0.01em] truncate max-w-[100px] sm:max-w-[200px]">
          {roomName || "Room"}
        </span>

        <button
          onClick={copyRoomCode}
          className="text-[12px] sm:text-[14px] font-mono text-nocta-text-muted hover:text-nocta-text-secondary
            transition-colors duration-300 cursor-pointer shrink-0"
        >
          {roomCode} {copied ? "✓" : ""}
        </button>

        <div className="hidden sm:block w-px h-5 bg-nocta-border" />

        <div className="hidden sm:block shrink-0">
          <ParticipantList />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="block sm:hidden shrink-0 mr-1">
          <ParticipantList />
        </div>

        {/* Reactions */}
        <div className="relative">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center
              text-nocta-text-muted hover:text-nocta-text-secondary hover:bg-nocta-surface
              transition-all duration-300 text-lg sm:text-xl cursor-pointer"
          >
            ☺
          </button>
          <AnimatePresence>
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 flex gap-1 p-2 rounded-2xl
                  bg-[#0F0F12] border border-nocta-border z-20 shadow-xl"
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      sendReaction(emoji);
                      setShowReactions(false);
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl
                      hover:bg-nocta-surface transition-colors duration-200 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat toggle */}
        <button
          onClick={toggleChat}
          className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center
            transition-all duration-300 cursor-pointer
            ${isChatOpen
              ? "bg-nocta-accent/10 text-nocta-accent"
              : "text-nocta-text-muted hover:text-nocta-text-secondary hover:bg-nocta-surface"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {!isChatOpen && unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-nocta-accent rounded-full shadow-[0_0_8px_rgba(168,158,200,0.8)]" />
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={isSharing ? stopScreenShare : startScreenShare}
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center
            transition-all duration-300 cursor-pointer
            ${isSharing
              ? "bg-nocta-success/10 text-nocta-success"
              : "text-nocta-text-muted hover:text-nocta-text-secondary hover:bg-nocta-surface"}`}
          title={isSharing ? "Stop sharing" : "Share screen"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </button>

        {/* Leave */}
        <button
          onClick={handleLeave}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center
            text-nocta-text-muted hover:text-nocta-danger hover:bg-nocta-danger/10
            transition-all duration-300 cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
