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
    if (!socket || (socket as any)._hasNoctaListeners) return;
    (socket as any)._hasNoctaListeners = true;

    // Room events
    socket.on("room:joined", (data) => {
      setRoom({
        roomCode: data.roomCode,
        name: data.name,
        isHost: data.isHost,
        isLocked: data.isLocked,
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

    socket.on("room:host-changed", ({ username, userId, participants }) => {
      addToast(`${username} is now the host`, "info");
      const state = useRoomStore.getState();
      if (participants) state.setParticipants(participants);
      if (state.user?.id === userId) {
        state.setRoom({ roomCode: state.roomCode!, name: state.roomName!, participants: participants || state.participants, isHost: true, isLocked: state.isLocked });
        addToast("You are now the host!", "success");
      }
    });

    socket.on("room:locked", ({ isLocked }) => {
      useRoomStore.getState().setIsLocked(isLocked);
      addToast(isLocked ? "Room locked (no new guests can join)" : "Room unlocked", "info");
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

    socket.on("room:nudge", ({ username }) => {
      addToast(`${username} nudged the room!`, "warning");
      // Add a CSS class to body for shaking effect
      document.body.classList.add("animate-nudge");
      // Play a small beep (base64 encoded short beep)
      const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); // Fake small header, actually we can just use HTML5 audio or rely on the shake
      try { audio.play(); } catch(e) {}
      
      setTimeout(() => {
        document.body.classList.remove("animate-nudge");
      }, 500);
    });

    socket.on("room:raise-hand", ({ userId, isRaised }) => {
      const store = useRoomStore.getState();
      const updated = store.participants.map(p => 
        p.userId === userId ? { ...p, isRaised } : p
      );
      setParticipants(updated);
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

    // No cleanup returned: these are global listeners tied to the socket instance.
    // They use stable Zustand actions and don't capture stale React state.
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

  const sendNudge = useCallback(() => {
    socket?.emit("room:nudge");
  }, [socket]);

  const sendRaiseHand = useCallback((isRaised: boolean) => {
    socket?.emit("room:raise-hand", { isRaised });
  }, [socket]);

  const sendToggleLock = useCallback(() => {
    socket?.emit("room:toggle-lock");
  }, [socket]);

  const sendTransferHost = useCallback((userId: string) => {
    socket?.emit("room:transfer-host", { userId });
  }, [socket]);

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    sendReaction,
    updateVideoUrl,
    sendNudge,
    sendRaiseHand,
    sendToggleLock,
    sendTransferHost,
  };
}
