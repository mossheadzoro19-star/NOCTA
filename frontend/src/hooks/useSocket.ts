"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSocketContext } from "@/context/SocketProvider";
import { useRoomStore } from "@/stores/roomStore";

/**
 * Hook to manage socket events for a room.
 * Handles: join, leave, chat, typing, reactions, participant updates.
 */
export function useSocket() {
  const router = useRouter();
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

    socket.on("room:user-left", ({ user, participants, newHost, kicked }) => {
      setParticipants(participants);
      addToast(kicked ? `${user.username} was kicked` : `${user.username} left`, "info");
      if (newHost) {
        addToast(`${newHost} is now the host`, "info");
      }
    });

    socket.on("room:host-changed", ({ username }) => {
      addToast(`${username} is now the host`, "info");
    });

    socket.on("room:kicked", ({ message }) => {
      addToast(message, "error");
      useRoomStore.getState().clearRoom();
    });

    socket.on("room:video-changed", ({ videoUrl }) => {
      setPlayback({ videoUrl, currentTime: 0, isPlaying: false });
    });

    socket.on("room:error", ({ message }) => {
      addToast(message, "error");
      if (
        message === "Room not found" ||
        message === "Room is full" ||
        message === "You have been removed from this room"
      ) {
        router.push("/");
      }
    });

    // Chat events
    socket.on("chat:message", (msg) => {
      // Don't add if we just sent it (optimistic UI handles this)
      const state = useRoomStore.getState();
      if (msg.userId === state.user?.id && !msg.tempId) {
         // Wait, the broadcast from server to the room goes to OTHER clients, not the sender.
         // Oh, io.to(roomCode) emits to everyone INCLUDING sender if we don't use socket.to.
         // Wait! chatHandler.js was updated to use socket.to(roomCode).emit()
         // which EXCLUDES the sender. So we don't receive our own message here!
      }
      addMessage(msg);
      useRoomStore.getState().incrementUnread();
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

    // WebRTC & Media events
    socket.on("webrtc:peer-disconnected", ({ username }) => {
      if (username) {
        addToast(`Lost connection to ${username}`, "warning");
      }
    });

    socket.on("webrtc:media-state", ({ username, isCameraOn, isMicOn }) => {
      if (isCameraOn !== undefined) addToast(`${username} ${isCameraOn ? 'enabled' : 'disabled'} their camera`, "info");
      else if (isMicOn !== undefined) addToast(`${username} ${isMicOn ? 'enabled' : 'disabled'} their mic`, "info");
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
      socket.off("room:host-changed");
      socket.off("room:kicked");
      socket.off("webrtc:peer-disconnected");
      socket.off("webrtc:media-state");
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
      if (!socket) return;
      const state = useRoomStore.getState();
      if (!state.user) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const optimisticMsg = {
        id: tempId,
        userId: state.user.id,
        username: state.user.username,
        avatarColor: state.user.avatarColor,
        content,
        type: "message" as const,
        createdAt: new Date().toISOString(),
      };

      state.addMessage(optimisticMsg);

      socket.emit("chat:message", { content, tempId }, (response: any) => {
        if (response?.error) {
          useRoomStore.getState().removeMessage(tempId);
          useRoomStore.getState().addToast(response.error, "error");
        } else if (response?.success && response?.message) {
          useRoomStore.getState().updateMessageId(tempId, response.message);
        }
      });
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
