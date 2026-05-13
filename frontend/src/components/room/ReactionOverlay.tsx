"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocketContext } from "@/context/SocketProvider";

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

export default function ReactionOverlay() {
  const { socket } = useSocketContext();
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleReaction = ({ emoji }: { emoji: string }) => {
      const id = Date.now().toString() + Math.random();
      const x = 15 + Math.random() * 70;

      setReactions((prev) => [...prev, { id, emoji, x }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);
    };

    socket.on("chat:reaction", handleReaction);
    return () => { socket.off("chat:reaction", handleReaction); };
  }, [socket]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0.8, y: "90vh", scale: 1 }}
            animate={{ opacity: 0, y: "10vh", scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut" }}
            style={{ left: `${r.x}%` }}
            className="absolute text-3xl"
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
