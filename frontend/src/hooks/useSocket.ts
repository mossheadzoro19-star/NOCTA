"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSocketContext } from "@/context/SocketProvider";
import { useRoomStore } from "@/stores/roomStore";

/**
 * Hook to manage socket events for a room.
 * Handles: join, leave, chat, typing, reactions, participant updates.
 */
export function useSocket() {
  const { socket, isConnected } = useSocketContext();
  const addMessage = useRoomStore((s) => s.addMessage);
  const setParticipants = useRoomStore((s) => s.setParticipants);
  const setRoom = useRoomStore((s) => s.setRoom);
  const setPlayback = useRoomStore((s) => s.setPlayback);
  const addToast = useRoomStore((s) => s.addToast);
  const setTypingUsers = useRoomStore((s) => s.setTypingUsers);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!socket) return;

    // Room events
    socket.on("room:joined", (data) => {
      setRoom({
        roomCode: data.roomCode,
        name: data.name,
        isHost: data.isHost,
        participants: data.participants,
      });
      if (data.playback) {
        setPlayback(data.playback);
      }
      if (data.videoUrl) {
        setPlayback({ videoUrl: data.videoUrl });
      }
    });

    socket.on("room:user-joined", ({ user, participants }) => {
      setParticipants(participants);
      addToast(`${user.username} joined`, "info");
    });

    socket.on("room:user-left", ({ user, participants, newHost }) => {
      setParticipants(participants);
      addToast(`${user.username} left`, "info");
      if (newHost) {
        addToast(`${newHost} is now the host`, "info");
      }
    });

    socket.on("room:video-changed", ({ videoUrl }) => {
      setPlayback({ videoUrl, currentTime: 0, isPlaying: false });
    });

    socket.on("room:error", ({ message }) => {
      addToast(message, "error");
    });

    // Chat events
    socket.on("chat:message", (msg) => {
      addMessage(msg);
    });

    socket.on("chat:typing", ({ username, isTyping }) => {
      // Clear existing timeout for this user
      const existing = typingTimeouts.current.get(username);
      if (existing) clearTimeout(existing);

      if (isTyping) {
        const store = useRoomStore.getState();
        if (!store.typingUsers.includes(username)) {
          setTypingUsers([...store.typingUsers, username]);
        }
        // Auto-clear after 3 seconds
        const timeout = setTimeout(() => {
          const s = useRoomStore.getState();
          setTypingUsers(s.typingUsers.filter((u) => u !== username));
          typingTimeouts.current.delete(username);
        }, 3000);
        typingTimeouts.current.set(username, timeout);
      } else {
        const store = useRoomStore.getState();
        setTypingUsers(store.typingUsers.filter((u) => u !== username));
      }
    });

    // Reconnect recovery
    socket.on("reconnect:state", (data) => {
      if (data.roomCode) {
        setRoom({
          roomCode: data.roomCode,
          name: "",
          isHost: false,
          participants: data.participants || [],
        });
        if (data.playback) setPlayback(data.playback);
      }
    });

    return () => {
      socket.off("room:joined");
      socket.off("room:user-joined");
      socket.off("room:user-left");
      socket.off("room:video-changed");
      socket.off("room:error");
      socket.off("chat:message");
      socket.off("chat:typing");
      socket.off("reconnect:state");
      typingTimeouts.current.forEach((t) => clearTimeout(t));
    };
  }, [socket, setRoom, setParticipants, setPlayback, addMessage, addToast, setTypingUsers]);

  const joinRoom = useCallback(
    (roomCode: string) => {
      socket?.emit("room:join", { roomCode });
    },
    [socket]
  );

  const leaveRoom = useCallback(() => {
    socket?.emit("room:leave");
    useRoomStore.getState().clearRoom();
  }, [socket]);

  const sendMessage = useCallback(
    (content: string) => {
      socket?.emit("chat:message", { content });
    },
    [socket]
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      socket?.emit("chat:typing", { isTyping });
    },
    [socket]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      socket?.emit("chat:reaction", { emoji });
    },
    [socket]
  );

  const updateVideoUrl = useCallback(
    (videoUrl: string) => {
      socket?.emit("room:update-video", { videoUrl });
    },
    [socket]
  );

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    sendReaction,
    updateVideoUrl,
  };
}
