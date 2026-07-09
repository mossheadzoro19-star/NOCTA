"use client";

import { motion } from "framer-motion";
import { useRoomStore } from "@/stores/roomStore";
import Avatar from "@/components/ui/Avatar";

export default function ParticipantList() {
  const participants = useRoomStore((s) => s.participants);

  return (
    <div className="flex items-center gap-[-4px]">
      {participants.map((p, i) => (
        <motion.div
          key={p.socketId}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04, duration: 0.2, ease: "easeOut" }}
          className="group relative -ml-1 first:ml-0"
        >
          <Avatar
            username={p.username}
            color={p.avatarColor}
            size="sm"
            isOnline={true}
          />

          {p.isRaised && (
            <div className="absolute -top-2 -right-1 bg-[#D4A88C] text-black text-[10px] w-4 h-4 
              rounded-full flex items-center justify-center shadow-md z-20 animate-bounce">
              ✋
            </div>
          )}

          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
            <div className="bg-[#0F0F12] border border-nocta-border rounded-xl
              px-2.5 py-1 text-[11px] text-nocta-text-secondary whitespace-nowrap">
              {p.username}{p.isHost ? " · host" : ""}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
