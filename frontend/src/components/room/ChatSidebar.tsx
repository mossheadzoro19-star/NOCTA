"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "@/stores/roomStore";
import { useSocket } from "@/hooks/useSocket";
import Avatar from "@/components/ui/Avatar";
import { formatTimestamp } from "@/lib/utils";

export default function ChatSidebar() {
  const messages = useRoomStore((s) => s.messages);
  const typingUsers = useRoomStore((s) => s.typingUsers);
  const user = useRoomStore((s) => s.user);
  const isChatOpen = useRoomStore((s) => s.isChatOpen);
  const participants = useRoomStore((s) => s.participants);
  const isHost = useRoomStore((s) => s.isHost);
  const { sendMessage, sendTyping, sendTransferHost, sendKick } = useSocket();

  const [activeTab, setActiveTab] = useState<"chat" | "people">("chat");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = useCallback(
    (val: string) => {
      setInput(val);
      if (val.trim()) {
        sendTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => sendTyping(false), 2000);
      } else {
        sendTyping(false);
      }
    },
    [sendTyping]
  );

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
    sendTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  };

  const filteredTyping = typingUsers.filter((u) => u !== user?.username);

  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "100%" }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-y-0 right-0 sm:relative sm:max-w-[340px] h-full bg-nocta-bg/95 sm:bg-nocta-bg border-l border-nocta-border
            flex flex-col overflow-hidden shrink-0 z-30 backdrop-blur-xl sm:backdrop-blur-none"
        >
          {/* Tabs */}
          <div className="flex px-4 pt-4 pb-2 gap-4 border-b border-nocta-border/50 shrink-0">
            <button
              onClick={() => setActiveTab("chat")}
              className={`text-[14px] font-bold pb-1 border-b-2 transition-colors duration-200 cursor-pointer
                ${activeTab === "chat" ? "border-nocta-accent text-nocta-text" : "border-transparent text-nocta-text-muted hover:text-nocta-text-secondary"}`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab("people")}
              className={`text-[14px] font-bold pb-1 border-b-2 transition-colors duration-200 cursor-pointer flex items-center gap-1.5
                ${activeTab === "people" ? "border-nocta-accent text-nocta-text" : "border-transparent text-nocta-text-muted hover:text-nocta-text-secondary"}`}
            >
              People <span className="bg-nocta-surface px-1.5 py-0.5 rounded-md text-[10px]">{participants.length}</span>
            </button>
          </div>

          {activeTab === "chat" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-[15px] text-nocta-text-muted">
                  Start a conversation.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const isOwn = msg.userId === user?.id;
              const isSystem = msg.type === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center py-1">
                    <span className="text-[11px] text-nocta-text-muted">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="group"
                >
                  {!isOwn && (
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar
                        username={msg.username}
                        color={msg.avatarColor}
                        size="sm"
                      />
                      <span className="text-[11px] font-medium text-nocta-text-muted">
                        {msg.username}
                      </span>
                      <span className="text-[10px] text-nocta-text-muted/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTimestamp(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`text-[15px] leading-relaxed ${
                      isOwn
                        ? "text-nocta-text ml-auto text-right"
                        : "text-nocta-text-secondary pl-8"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing */}
          <AnimatePresence>
            {filteredTyping.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-1"
              >
                <span className="text-[11px] text-nocta-text-muted">
                  {filteredTyping.join(", ")} typing...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="px-3 py-3 border-t border-nocta-border">
            <input
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message"
              maxLength={500}
              className="w-full bg-nocta-surface border border-nocta-border rounded-2xl
                px-5 py-3 text-[16px] text-nocta-text placeholder-nocta-text-muted
                focus:outline-none focus:border-nocta-border-hover transition-colors duration-300"
            />
          </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {participants.map(p => (
                <div key={p.socketId} className="flex items-center justify-between p-2 rounded-xl hover:bg-nocta-surface transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar username={p.username} color={p.avatarColor} size="md" />
                      {p.isRaised && (
                        <div className="absolute -top-1 -right-1 bg-[#D4A88C] text-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-bounce">
                          ✋
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[14px] font-semibold text-nocta-text">
                        {p.username} {p.userId === user?.id && "(You)"}
                      </span>
                      <span className="text-[11px] text-nocta-accent">
                        {p.isHost ? "Host" : "Guest"}
                      </span>
                    </div>
                  </div>

                  {isHost && p.userId !== user?.id && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => sendTransferHost(p.userId)}
                        className="text-[11px] font-bold px-2 py-1 bg-nocta-accent/10 text-nocta-accent rounded-lg hover:bg-nocta-accent hover:text-nocta-bg transition-colors cursor-pointer"
                        title="Make Host"
                      >
                        👑
                      </button>
                      <button 
                        onClick={() => sendKick(p.userId)}
                        className="text-[11px] font-bold px-2 py-1 bg-nocta-danger/10 text-nocta-danger rounded-lg hover:bg-nocta-danger hover:text-white transition-colors cursor-pointer"
                        title="Kick"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
