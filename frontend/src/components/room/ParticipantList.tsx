"use client";

import { motion } from "framer-motion";
import { useRoomStore } from "@/stores/roomStore";
import { useSocket } from "@/hooks/useSocket";
import Avatar from "@/components/ui/Avatar";

export default function ParticipantList() {
  const participants = useRoomStore((s) => s.participants);
  const isHost = useRoomStore((s) => s.isHost);
  const user = useRoomStore((s) => s.user);
  const { sendTransferHost } = useSocket();

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

          {/* Tooltip & Actions */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto z-10 flex flex-col items-center gap-1">
            <div className="bg-[#0F0F12] border border-nocta-border rounded-xl
              px-2.5 py-1 text-[11px] text-nocta-text-secondary whitespace-nowrap">
              {p.username}{p.isHost ? " · host" : ""}
            </div>
            {isHost && user?.id !== p.userId && (
              <button 
                onClick={() => sendTransferHost(p.userId)}
                className="bg-nocta-accent text-nocta-bg text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap hover:bg-white transition-colors cursor-pointer"
              >
                Make Host
              </button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
