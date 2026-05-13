"use client";

import { create, StateCreator } from "zustand";

// --- Types ---
export interface User { id: string; username: string; avatarColor: string; }
export interface Participant { socketId: string; userId: string; username: string; avatarColor: string; isHost: boolean; joinedAt: number; }
export interface PlaybackState { isPlaying: boolean; currentTime: number; lastUpdated: number; playbackRate: number; videoUrl: string; }
export interface ChatMessage { id: string; userId: string; username: string; avatarColor: string; content: string; type: "message" | "reaction" | "system"; createdAt: string; }
export interface Toast { id: string; message: string; type: "info" | "success" | "error" | "warning"; }
export interface P2PState { magnetURI: string | null; status: "idle" | "validating" | "seeding" | "discovering" | "buffering" | "ready" | "playing" | "degraded" | "error"; downloadSpeed: number; uploadSpeed: number; peers: number; progress: number; bufferHealth: "good" | "warning" | "critical"; errorReason: string | null; }

// --- Root State Interface ---
export interface RootState extends IdentitySlice, RoomSlice, SyncSlice, P2PSlice, UISlice, DiagnosticsSlice {}

// --- Slices ---

// 1. Identity Slice
export interface IdentitySlice {
  user: User | null;
  token: string | null;
  setUser: (user: User, token: string) => void;
  clearUser: () => void;
  recoverSession: () => boolean;
}
const createIdentitySlice: StateCreator<RootState, [], [], IdentitySlice> = (set) => ({
  user: null,
  token: null,
  setUser: (user, token) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nocta_token", token);
      localStorage.setItem("nocta_user", JSON.stringify(user));
    }
    set({ user, token });
  },
  clearUser: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("nocta_token");
      localStorage.removeItem("nocta_user");
    }
    set({ user: null, token: null });
  },
  recoverSession: () => {
    if (typeof window === "undefined") return false;
    const token = localStorage.getItem("nocta_token");
    const userStr = localStorage.getItem("nocta_user");
    if (token && userStr) {
      try {
        set({ user: JSON.parse(userStr), token });
        return true;
      } catch (e) {}
    }
    return false;
  }
});

// 2. Room Slice
export interface RoomSlice {
  roomCode: string | null;
  roomName: string | null;
  isHost: boolean;
  participants: Participant[];
  setRoom: (data: { roomCode: string; name: string; isHost: boolean; participants: Participant[]; }) => void;
  setParticipants: (p: Participant[]) => void;
  clearRoom: () => void;
}
const createRoomSlice: StateCreator<RootState, [], [], RoomSlice> = (set, get) => ({
  roomCode: null,
  roomName: null,
  isHost: false,
  participants: [],
  setRoom: (data) => {
    set({ roomCode: data.roomCode, roomName: data.name, isHost: data.isHost, participants: data.participants });
    if (typeof window !== "undefined") {
      sessionStorage.setItem("nocta_session", JSON.stringify({ roomCode: data.roomCode, isHost: data.isHost }));
    }
  },
  setParticipants: (participants) => set({ participants }),
  clearRoom: () => {
    if (typeof window !== "undefined") sessionStorage.removeItem("nocta_session");
    set({ roomCode: null, roomName: null, isHost: false, participants: [], messages: [], typingUsers: [] });
    get().resetSync();
    get().cleanupP2P();
  }
});

// 3. Sync Slice
export interface SyncSlice {
  playback: PlaybackState;
  setPlayback: (p: Partial<PlaybackState>) => void;
  resetSync: () => void;
}
const createSyncSlice: StateCreator<RootState, [], [], SyncSlice> = (set) => ({
  playback: { isPlaying: false, currentTime: 0, lastUpdated: Date.now(), playbackRate: 1, videoUrl: "" },
  setPlayback: (p) => set((s) => ({ playback: { ...s.playback, ...p } })),
  resetSync: () => set({ playback: { isPlaying: false, currentTime: 0, lastUpdated: Date.now(), playbackRate: 1, videoUrl: "" } })
});

// 4. P2P Slice
export interface P2PSlice {
  p2p: P2PState;
  setP2PState: (state: Partial<P2PState>) => void;
  cleanupP2P: () => void;
}
const createP2PSlice: StateCreator<RootState, [], [], P2PSlice> = (set) => ({
  p2p: { magnetURI: null, status: "idle", downloadSpeed: 0, uploadSpeed: 0, peers: 0, progress: 0, bufferHealth: "good", errorReason: null },
  setP2PState: (p) => set((s) => ({ p2p: { ...s.p2p, ...p } })),
  cleanupP2P: () => set({ p2p: { magnetURI: null, status: "idle", downloadSpeed: 0, uploadSpeed: 0, peers: 0, progress: 0, bufferHealth: "good", errorReason: null } })
});

// 5. Diagnostics Slice
export interface DiagnosticsSlice {
  showDiagnostics: boolean;
  toggleDiagnostics: () => void;
}
const createDiagnosticsSlice: StateCreator<RootState, [], [], DiagnosticsSlice> = (set) => ({
  showDiagnostics: false,
  toggleDiagnostics: () => set((s) => ({ showDiagnostics: !s.showDiagnostics }))
});

// 6. UI Slice
export interface UISlice {
  messages: ChatMessage[];
  addMessage: (m: ChatMessage) => void;
  setMessages: (m: ChatMessage[]) => void;
  typingUsers: string[];
  setTypingUsers: (u: string[]) => void;
  isChatOpen: boolean;
  toggleChat: () => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;
  isFullscreen: boolean;
  setFullscreen: (v: boolean) => void;
}
const createUISlice: StateCreator<RootState, [], [], UISlice> = (set, get) => ({
  messages: [],
  addMessage: (m) => set((s) => {
    if (s.messages.some((msg) => msg.id === m.id)) return s;
    return { messages: [...s.messages.slice(-200), m] };
  }),
  setMessages: (messages) => set({ messages }),
  typingUsers: [],
  setTypingUsers: (typingUsers) => set({ typingUsers }),
  isChatOpen: true,
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  authModalOpen: false,
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),
  toasts: [],
  addToast: (message, type = "info") => {
    const id = Date.now().toString();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  isFullscreen: false,
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
});

// --- Combine Store ---
export const useRoomStore = create<RootState>()((...a) => ({
  ...createIdentitySlice(...a),
  ...createRoomSlice(...a),
  ...createSyncSlice(...a),
  ...createP2PSlice(...a),
  ...createDiagnosticsSlice(...a),
  ...createUISlice(...a),
}));
