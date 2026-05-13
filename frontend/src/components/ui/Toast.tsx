"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "@/stores/roomStore";

export default function Toast() {
  const toasts = useRoomStore((s) => s.toasts);
  const removeToast = useRoomStore((s) => s.removeToast);

  const borderColors: Record<string, string> = {
    info: "border-nocta-accent/10",
    success: "border-nocta-success/10",
    error: "border-nocta-danger/10",
    warning: "border-nocta-accent/10",
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-xs">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`px-4 py-3 rounded-2xl bg-[#0F0F12] border
              ${borderColors[toast.type]} cursor-pointer`}
            onClick={() => removeToast(toast.id)}
          >
            <span className="text-[13px] text-nocta-text-secondary">
              {toast.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
