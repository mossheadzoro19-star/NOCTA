"use client";

import { useEffect, useState } from "react";
import { useRoomStore } from "@/stores/roomStore";
import { useSocketContext } from "@/context/SocketProvider";

/**
 * Global keyboard shortcuts for room navigation and playback control.
 */
export function useKeyboardShortcuts() {
  const { socket } = useSocketContext();
  const isHost = useRoomStore((s) => s.isHost);
  const playback = useRoomStore((s) => s.playback);
  const toggleChat = useRoomStore((s) => s.toggleChat);
  const isChatOpen = useRoomStore((s) => s.isChatOpen);
  const isFullscreen = useRoomStore((s) => s.isFullscreen);
  const setFullscreen = useRoomStore((s) => s.setFullscreen);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault(); // prevent scrolling
          if (isHost && socket) {
            const eventName = playback.isPlaying ? "sync:pause" : "sync:play";
            socket.emit(eventName, { currentTime: playback.currentTime });
          }
          break;
        case "f":
          e.preventDefault();
          setFullscreen(!isFullscreen);
          break;
        case "m":
          e.preventDefault();
          // Find video element and toggle mute
          const video = document.querySelector("video");
          if (video) video.muted = !video.muted;
          break;
        case "escape":
          if (isFullscreen) {
            setFullscreen(false);
          } else if (isChatOpen) {
            toggleChat();
          }
          break;
        case "c":
          e.preventDefault();
          toggleChat();
          break;
        case "j":
          e.preventDefault();
          if (isHost && socket) {
            const targetTime = Math.max(0, playback.currentTime - 10);
            socket.emit("sync:seek", { targetTime });
          }
          break;
        case "l":
          e.preventDefault();
          if (isHost && socket) {
            const targetTime = playback.currentTime + 10;
            socket.emit("sync:seek", { targetTime });
          }
          break;
        case "?":
          if (e.shiftKey) {
            e.preventDefault();
            setShowHelp((prev) => !prev);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [socket, isHost, playback, isFullscreen, setFullscreen, isChatOpen, toggleChat]);

  return { showHelp, setShowHelp };
}
