"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRoomStore } from "@/stores/roomStore";
import Avatar from "@/components/ui/Avatar";

export default function Navbar() {
  const user = useRoomStore((s) => s.user);
  const clearUser = useRoomStore((s) => s.clearUser);

  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.1 }}
      className="fixed top-0 left-0 right-0 z-40"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-[20px] sm:text-[24px] font-bold tracking-tight text-nocta-text text-gradient hover:opacity-90 transition-opacity">
            NOCTA
          </span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3 bg-white/5 rounded-2xl p-1 pr-2 border border-white/5">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <Avatar
                  username={user.username}
                  color={user.avatarColor}
                  size="sm"
                />
                <span className="text-[13px] sm:text-[14px] font-semibold text-nocta-text hidden sm:block">
                  {user.username}
                </span>
              </div>
              <div className="w-px h-4 bg-white/10 hidden sm:block" />
              <button
                onClick={clearUser}
                title="Sign out"
                className="p-1.5 sm:p-2 rounded-xl text-nocta-text-muted hover:text-nocta-danger hover:bg-nocta-danger/10
                  transition-all duration-300 cursor-pointer"
              >
                <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => useRoomStore.getState().setAuthModalOpen(true)}
              className="text-[13px] sm:text-[14px] font-bold text-nocta-text hover:text-nocta-accent
                transition-all duration-300 cursor-pointer px-4 py-2 sm:px-5 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
