import { StateCreator } from "zustand";
import { RootState } from "../roomStore";

export interface IdentitySlice {
  user: { id: string; username: string; avatarColor: string } | null;
  token: string | null;
  setUser: (user: { id: string; username: string; avatarColor: string }, token: string) => void;
  clearUser: () => void;
  recoverSession: () => boolean;
}

export const createIdentitySlice: StateCreator<RootState, [], [], IdentitySlice> = (set) => ({
  user: null,
  token: null,
  setUser: (user, token) => {
    localStorage.setItem("nocta_token", token);
    localStorage.setItem("nocta_user", JSON.stringify(user));
    set({ user, token });
  },
  clearUser: () => {
    localStorage.removeItem("nocta_token");
    localStorage.removeItem("nocta_user");
    set({ user: null, token: null });
  },
  recoverSession: () => {
    const token = localStorage.getItem("nocta_token");
    const userStr = localStorage.getItem("nocta_user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token });
        return true;
      } catch (e) {}
    }
    return false;
  }
});
