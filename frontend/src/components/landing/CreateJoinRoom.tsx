"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { apiRequest } from "@/lib/utils";
import { useRoomStore } from "@/stores/roomStore";

type AuthMode = "selection" | "guest" | "login" | "register";

export default function CreateJoinRoom() {
  const router = useRouter();
  const user = useRoomStore((s) => s.user);
  const setUser = useRoomStore((s) => s.setUser);
  const addToast = useRoomStore((s) => s.addToast);
  
  // Global Auth Modal State
  const showAuth = useRoomStore((s) => s.authModalOpen);
  const setShowAuth = useRoomStore((s) => s.setAuthModalOpen);

  const [authMode, setAuthMode] = useState<AuthMode>("selection");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [joinCode, setJoinCode] = useState("");

  const resetAuth = () => {
    setShowAuth(false);
    setAuthMode("selection");
    setAuthError("");
    setFormData({ username: "", email: "", password: "" });
    setPendingAction(null);
  };

  const handleAuthSuccess = (data: any) => {
    setUser(data.user, data.token);
    resetAuth();
    if (pendingAction === "create") setShowCreate(true);
  };

  const handleGuestAuth = async () => {
    const name = formData.username.trim();
    if (!name || name.length < 3) {
      setAuthError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      setAuthError("Letters, numbers, and underscores only");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await apiRequest("/api/auth/guest", {
        method: "POST",
        body: JSON.stringify({ username: name }),
      });
      handleAuthSuccess(data);
    } catch (err: any) {
      setAuthError(err.message || "Try a different name");
    } finally {
      setAuthLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    return email.toLowerCase().endsWith("@gmail.com");
  };

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;
    return regex.test(password);
  };

  const handleLogin = async () => {
    if (!formData.email.trim() || !formData.password) {
      setAuthError("Email and password are required");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });
      handleAuthSuccess(data);
      addToast("Welcome back!", "success");
    } catch (err: any) {
      setAuthError(err.message || "Invalid email or password");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.username.trim() || !formData.email.trim() || !formData.password) {
      setAuthError("Please fill all fields");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) {
      setAuthError("Username: letters, numbers, and underscores only");
      return;
    }

    if (!validateEmail(formData.email)) {
      setAuthError("Only @gmail.com addresses are allowed");
      return;
    }

    if (!validatePassword(formData.password)) {
      setAuthError("Password must be 8+ chars with number & special char");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
        }),
      });
      handleAuthSuccess(data);
      addToast("Account created!", "success");
    } catch (err: any) {
      setAuthError(err.message || "Registration failed");
    } finally {
      setAuthLoading(false);
    }
  };



  const handleCreate = async () => {
    if (!user) { setPendingAction("create"); setShowAuth(true); return; }
    if (!roomName.trim()) return;
    setCreateLoading(true);
    try {
      const data = await apiRequest("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ name: roomName.trim() }),
      });
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      addToast(err.message || "Failed to create room", "error");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    if (!user) { setPendingAction("join"); setShowAuth(true); return; }
    router.push(`/room/${joinCode.trim().toUpperCase()}`);
  };

  const handleAction = (action: "create" | "join") => {
    if (!user) { setPendingAction(action); setShowAuth(true); return; }
    if (action === "create") setShowCreate(true);
  };

  const updateFormData = (key: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setAuthError("");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="max-w-lg mx-auto px-6 pt-14 pb-32"
      >
        <div className="grid grid-cols-2 gap-3">
          {/* Create Room */}
          <button
            onClick={() => handleAction("create")}
            className="group p-6 rounded-2xl bg-white/5 border border-white/10
              hover:border-nocta-accent/30 hover:bg-white/8
              transition-all duration-500 text-left cursor-pointer shadow-sm hover:shadow-nocta-accent/5"
          >
            <div className="text-[17px] font-bold text-nocta-text mb-2">
              Create room
            </div>
            <div className="text-[14px] text-nocta-text-muted leading-relaxed">
              Host a private session
            </div>
          </button>

          {/* Join Room */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10
            transition-all duration-500 shadow-sm">
            <div className="text-[17px] font-bold text-nocta-text mb-4">
              Join room
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="000000"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-xl
                  px-3 py-2 text-[13px] text-nocta-text placeholder-white/30
                  font-mono tracking-widest text-center
                  focus:outline-none focus:border-nocta-accent/50 transition-colors duration-300"
              />
              <button
                onClick={handleJoin}
                disabled={!joinCode.trim()}
                className={`px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all duration-300 cursor-pointer
                  ${joinCode.trim() 
                    ? "bg-nocta-accent text-white shadow-[0_0_15px_rgba(168,158,200,0.3)]" 
                    : "bg-white/5 text-nocta-text-muted opacity-40 cursor-not-allowed"
                  }`}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Auth Modal */}
      <Modal
        isOpen={showAuth}
        onClose={resetAuth}
      >
        <div className="min-h-[400px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {authMode === "selection" && (
              <motion.div
                key="selection"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="text-center">
                  <h2 className="text-[24px] font-bold text-nocta-text tracking-tight">
                    Welcome to NOCTA
                  </h2>
                  <p className="text-[14px] text-nocta-text-muted mt-2">
                    Start watching together in seconds
                  </p>
                </div>
                
                <div className="space-y-4">


                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="secondary"
                      className="py-3"
                      onClick={() => setAuthMode("guest")}
                    >
                      Guest Access
                    </Button>
                    <Button
                      variant="secondary"
                      className="py-3"
                      onClick={() => setAuthMode("login")}
                    >
                      Email Login
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {authMode === "guest" && (
              <motion.div
                key="guest"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <button
                    onClick={() => setAuthMode("selection")}
                    className="text-[13px] text-nocta-text-muted hover:text-nocta-text transition-colors mb-4 cursor-pointer flex items-center gap-2"
                  >
                    &larr; Back to options
                  </button>
                  <h2 className="text-[22px] font-bold text-nocta-text">
                    Guest Access
                  </h2>
                  <p className="text-[14px] text-nocta-text-muted mt-1">No account needed, just a nickname</p>
                </div>
                <Input
                  placeholder="Your nickname"
                  value={formData.username}
                  onChange={(e) => updateFormData("username", e.target.value)}
                  error={authError}
                  maxLength={20}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleGuestAuth()}
                />
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  onClick={handleGuestAuth}
                  loading={authLoading}
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {authMode === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <button
                    onClick={() => setAuthMode("selection")}
                    className="text-[13px] text-nocta-text-muted hover:text-nocta-text transition-colors mb-4 cursor-pointer flex items-center gap-2"
                  >
                    &larr; Back to options
                  </button>
                  <h2 className="text-[22px] font-bold text-nocta-text">
                    Sign In
                  </h2>
                </div>
                <div className="space-y-4">
                  <Input
                    placeholder="Gmail Address"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                  />
                  <Input
                    placeholder="Password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateFormData("password", e.target.value)}
                    error={authError}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleLogin}
                  loading={authLoading}
                >
                  Sign In
                </Button>
                <p className="text-[14px] text-center text-nocta-text-muted">
                  New here?{" "}
                  <button
                    onClick={() => { setAuthMode("register"); setAuthError(""); }}
                    className="text-nocta-accent font-semibold hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              </motion.div>
            )}

            {authMode === "register" && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <button
                    onClick={() => setAuthMode("login")}
                    className="text-[13px] text-nocta-text-muted hover:text-nocta-text transition-colors mb-4 cursor-pointer flex items-center gap-2"
                  >
                    &larr; Back to login
                  </button>
                  <h2 className="text-[22px] font-bold text-nocta-text">
                    Create Account
                  </h2>
                </div>
                <div className="space-y-4">
                  <Input
                    placeholder="Unique Username"
                    value={formData.username}
                    onChange={(e) => updateFormData("username", e.target.value)}
                  />
                  <Input
                    placeholder="Gmail Address (@gmail.com)"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                  />
                  <div className="space-y-2">
                    <Input
                      placeholder="Password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateFormData("password", e.target.value)}
                      error={authError}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    />
                    <div className="text-[11px] text-nocta-text-muted grid grid-cols-2 gap-1 px-1">
                      <div className={validatePassword(formData.password) ? "text-nocta-success" : ""}>• 8+ characters</div>
                      <div className={/[0-9]/.test(formData.password) ? "text-nocta-success" : ""}>• Includes number</div>
                      <div className={/[!@#$%^&*]/.test(formData.password) ? "text-nocta-success" : ""}>• Special character</div>
                      <div className={validateEmail(formData.email) ? "text-nocta-success" : ""}>• @gmail.com only</div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  onClick={handleRegister}
                  loading={authLoading}
                >
                  Create Account
                </Button>
                <p className="text-[14px] text-center text-nocta-text-muted">
                  Already have an account?{" "}
                  <button
                    onClick={() => { setAuthMode("login"); setAuthError(""); }}
                    className="text-nocta-accent font-semibold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Modal>

      {/* Create Room Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-[22px] font-bold text-nocta-text">
              Name your room
            </h2>
            <p className="text-[14px] text-nocta-text-muted mt-1">This will be visible to your guests</p>
          </div>
          <Input
            placeholder="e.g. Inception Night"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={50}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleCreate}
            loading={createLoading}
          >
            Create Room
          </Button>
        </div>
      </Modal>
    </>
  );
}
