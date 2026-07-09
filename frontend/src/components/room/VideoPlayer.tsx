"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "@/stores/roomStore";
import { useSocketContext } from "@/context/SocketProvider";
import dynamic from "next/dynamic";
import { extractYouTubeId, detectVideoSource } from "@/lib/utils";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import Button from "@/components/ui/Button";
import { useWebTorrent } from "@/hooks/useWebTorrent";
import LocalPlayer from "./LocalPlayer";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function VideoPlayer() {
  const { socket } = useSocketContext();
  const { updateVideoUrl } = useSocket();
  const { localStream, remoteStream, isSharing } = useWebRTC();
  const playback = useRoomStore((s) => s.playback);
  const isHost = useRoomStore((s) => s.isHost);
  const setPlayback = useRoomStore((s) => s.setPlayback);
  
  const { streamLocalFile } = useWebTorrent();

  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ignoreStateChange = useRef(false);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rtcVideoRef = useRef<HTMLVideoElement>(null);

  const [urlInput, setUrlInput] = useState("");
  const [apiReady, setApiReady] = useState(false);
  const [localFile, setLocalFile] = useState<File | null>(null);

  const p2p = useRoomStore((s) => s.p2p);
  const source = detectVideoSource(playback.videoUrl);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) { setApiReady(true); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setApiReady(true);
    return () => { window.onYouTubeIframeAPIReady = () => {}; };
  }, []);

  // YouTube player init
  useEffect(() => {
    if (!apiReady || source.type !== "youtube" || !source.id || !containerRef.current) return;
    if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }

    playerRef.current = new window.YT.Player("yt-player", {
      videoId: source.id,
      playerVars: {
        autoplay: 0, controls: isHost ? 1 : 0, modestbranding: 1,
        rel: 0, iv_load_policy: 3, fs: 1, playsinline: 1, color: "white",
      },
      events: {
        onReady: (event: any) => {
          if (playback.isPlaying && playback.currentTime > 0) {
            const elapsed = (Date.now() - playback.lastUpdated) / 1000;
            event.target.seekTo(playback.currentTime + elapsed, true);
            event.target.playVideo();
          }
        },
        onStateChange: (event: any) => {
          if (ignoreStateChange.current || !isHost) return;
          const state = event.data;
          const currentTime = event.target.getCurrentTime();
          if (state === window.YT.PlayerState.PLAYING) {
            socket?.emit("sync:play", { currentTime });
            setPlayback({ isPlaying: true, currentTime });
          } else if (state === window.YT.PlayerState.PAUSED) {
            socket?.emit("sync:pause", { currentTime });
            setPlayback({ isPlaying: false, currentTime });
          }
        },
      },
    });

    return () => { if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; } };
  }, [apiReady, source.type, source.id, isHost]);

  // HTML5 video sync events (for file uploads)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isHost || source.type !== "file") return;

    const onPlay = () => {
      if (ignoreStateChange.current) return;
      socket?.emit("sync:play", { currentTime: vid.currentTime });
      setPlayback({ isPlaying: true, currentTime: vid.currentTime });
    };
    const onPause = () => {
      if (ignoreStateChange.current) return;
      socket?.emit("sync:pause", { currentTime: vid.currentTime });
      setPlayback({ isPlaying: false, currentTime: vid.currentTime });
    };
    const onSeeked = () => {
      if (ignoreStateChange.current) return;
      socket?.emit("sync:seek", { targetTime: vid.currentTime });
      setPlayback({ currentTime: vid.currentTime });
    };

    vid.addEventListener("play", onPlay);
    vid.addEventListener("pause", onPause);
    vid.addEventListener("seeked", onSeeked);
    return () => {
      vid.removeEventListener("play", onPlay);
      vid.removeEventListener("pause", onPause);
      vid.removeEventListener("seeked", onSeeked);
    };
  }, [socket, isHost, source.type]);

  // Sync events from server (non-host)
  useEffect(() => {
    if (!socket || isHost) return;

    const handlePlay = ({ currentTime, serverTimestamp }: any) => {
      ignoreStateChange.current = true;
      const elapsed = (Date.now() - serverTimestamp) / 1000;
      const adjusted = currentTime + elapsed;

      if (source.type === "youtube" && playerRef.current) {
        playerRef.current.seekTo(adjusted, true);
        playerRef.current.playVideo();
      } else if (source.type === "file" && videoRef.current) {
        videoRef.current.currentTime = adjusted;
        videoRef.current.play();
      }
      setPlayback({ isPlaying: true, currentTime: adjusted });
      setTimeout(() => { ignoreStateChange.current = false; }, 500);
    };

    const handlePause = ({ currentTime }: any) => {
      ignoreStateChange.current = true;
      if (source.type === "youtube" && playerRef.current) {
        playerRef.current.pauseVideo();
        playerRef.current.seekTo(currentTime, true);
      } else if (source.type === "file" && videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = currentTime;
      }
      setPlayback({ isPlaying: false, currentTime });
      setTimeout(() => { ignoreStateChange.current = false; }, 500);
    };

    const handleSeek = ({ targetTime, serverTimestamp }: any) => {
      ignoreStateChange.current = true;
      const elapsed = (Date.now() - serverTimestamp) / 1000;
      const adjusted = targetTime + elapsed;
      if (source.type === "youtube" && playerRef.current) {
        playerRef.current.seekTo(adjusted, true);
      } else if (source.type === "file" && videoRef.current) {
        videoRef.current.currentTime = adjusted;
      }
      setPlayback({ currentTime: adjusted });
      setTimeout(() => { ignoreStateChange.current = false; }, 500);
    };

    const handleCorrect = ({ targetTime, mode, playbackRate }: any) => {
      if (mode === "seek") {
        ignoreStateChange.current = true;
        if (source.type === "youtube" && playerRef.current) playerRef.current.seekTo(targetTime, true);
        else if (source.type === "file" && videoRef.current) videoRef.current.currentTime = targetTime;
        setTimeout(() => { ignoreStateChange.current = false; }, 500);
      } else if (mode === "rate" && playbackRate) {
        if (source.type === "youtube" && playerRef.current) {
          playerRef.current.setPlaybackRate(playbackRate);
          setTimeout(() => { if (playerRef.current) playerRef.current.setPlaybackRate(1); }, 3000);
        } else if (source.type === "file" && videoRef.current) {
          videoRef.current.playbackRate = playbackRate;
          setTimeout(() => { if (videoRef.current) videoRef.current.playbackRate = 1; }, 3000);
        }
      }
    };

    socket.on("sync:play", handlePlay);
    socket.on("sync:pause", handlePause);
    socket.on("sync:seek", handleSeek);
    socket.on("sync:correct", handleCorrect);

    const handleP2PMagnet = ({ magnetURI }: any) => {
      useRoomStore.getState().setP2PState({ magnetURI });
    };
    socket.on("p2p:magnet", handleP2PMagnet);

    // Visibility Recovery System
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        ignoreStateChange.current = true;
      } else {
        // Recover drift softly
        setTimeout(() => {
          socket.emit("sync:request-state");
          ignoreStateChange.current = false;
        }, 1000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      socket.off("sync:play", handlePlay);
      socket.off("sync:pause", handlePause);
      socket.off("sync:seek", handleSeek);
      socket.off("sync:correct", handleCorrect);
      socket.off("p2p:magnet", handleP2PMagnet);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [socket, isHost, source.type, setPlayback]);

  // Sync freeze protection
  useEffect(() => {
    if (p2p.status === "buffering" || p2p.status === "degraded" || p2p.status === "error") {
      ignoreStateChange.current = true;
    } else if (p2p.status === "ready" || p2p.status === "playing") {
      ignoreStateChange.current = false;
    }
  }, [p2p.status]);

  // Heartbeat
  useEffect(() => {
    if (!socket || isHost) return;
    heartbeatInterval.current = setInterval(() => {
      let currentTime = 0;
      if (source.type === "youtube" && playerRef.current?.getCurrentTime) {
        currentTime = playerRef.current.getCurrentTime();
      } else if (source.type === "file" && videoRef.current) {
        currentTime = videoRef.current.currentTime;
      }
      if (currentTime > 0) socket.emit("sync:heartbeat", { currentTime });
    }, 2000);
    return () => { if (heartbeatInterval.current) clearInterval(heartbeatInterval.current); };
  }, [socket, isHost, source.type]);

  // Handle URL set
  const handleSetVideo = () => {
    if (!urlInput.trim()) return;
    const detected = detectVideoSource(urlInput.trim());
    if (detected.type !== "unknown") {
      updateVideoUrl(urlInput.trim());
      setUrlInput("");
      setLocalFile(null);
    }
  };

  // Handle file selection and validation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    streamLocalFile(file);
    updateVideoUrl("local://" + file.name);
  };

  useEffect(() => {
    if (rtcVideoRef.current) {
      if (remoteStream) rtcVideoRef.current.srcObject = remoteStream;
      else if (isSharing && localStream) rtcVideoRef.current.srcObject = localStream;
    }
  }, [remoteStream, localStream, isSharing]);

  const hasVideo = source.type !== "unknown" || p2p.status !== "idle" || isSharing || !!remoteStream;
  const videoUrl = p2p.magnetURI ? undefined : (playback.videoUrl.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${playback.videoUrl}` : playback.videoUrl);

  return (
    <div className="flex-1 flex flex-col bg-black/50 relative">
      {hasVideo ? (
        <div ref={containerRef} className="flex-1 relative">
          {/* YouTube */}
          {source.type === "youtube" && (
            <div id="yt-player" className="absolute inset-0 w-full h-full" />
          )}

          {/* Instagram embed */}
          {source.type === "instagram" && source.id && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <iframe
                src={`https://www.instagram.com/reel/${source.id}/embed/`}
                className="w-full max-w-[450px] h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            </div>
          )}

          {/* Local file or WebTorrent */}
          {p2p.status !== "idle" && (
            <LocalPlayer />
          )}

          {/* WebRTC Screen Share */}
          {(isSharing || remoteStream) && (
            <video
              ref={rtcVideoRef}
              autoPlay
              playsInline
              muted={isSharing}
              className="absolute inset-0 w-full h-full bg-black object-contain"
            />
          )}

          {/* Non-host overlay (YouTube only) */}
          {!isHost && source.type === "youtube" && (
            <div className="absolute inset-0 z-10 cursor-default" />
          )}
        </div>
      ) : (
        /* ─── Empty state ─── */
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center max-w-sm px-8"
          >
            {isHost ? (
              <>
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.03)]">
                  <svg className="w-8 h-8 text-nocta-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-[22px] font-bold text-nocta-text mb-2">Ready to watch?</h2>
                <p className="text-[16px] text-nocta-text-secondary mb-8 leading-relaxed">
                  Paste a link or upload a local file to start the synchronized session.
                </p>

                {/* URL input */}
                <div className="flex gap-2 mb-5">
                  <input
                    type="text"
                    placeholder="YouTube or Instagram link"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSetVideo()}
                    className="flex-1 bg-nocta-surface border border-nocta-border rounded-2xl
                      px-4 py-3.5 text-[15px] text-nocta-text placeholder-nocta-text-muted
                      focus:outline-none focus:border-nocta-border-hover transition-colors duration-300 shadow-sm"
                  />
                  <Button
                    size="lg"
                    onClick={handleSetVideo}
                    disabled={detectVideoSource(urlInput).type === "unknown"}
                  >
                    Play
                  </Button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex-1 h-px bg-nocta-border" />
                  <span className="text-[12px] font-bold text-nocta-text-muted uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-nocta-border" />
                </div>

                {/* File upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={p2p.status === "validating"}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-nocta-border
                    text-[15px] font-medium text-nocta-text-secondary hover:text-nocta-text
                    hover:border-nocta-accent/40 hover:bg-white/[0.02] transition-all duration-300 cursor-pointer
                    relative overflow-hidden group shadow-sm"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-nocta-text-muted group-hover:text-nocta-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {p2p.status === "validating" ? "Checking Codec..." : "Stream local video file"}
                    </div>
                    <span className="text-[11px] text-nocta-text-muted/70 mt-1 uppercase tracking-wider font-semibold">
                      [Experimental] MP4 / H.264 Only
                    </span>
                  </div>
                </button>
                {p2p.error && p2p.error.category === "VALIDATION_ERROR" && (
                  <p className="text-[14px] text-red-400 mt-3 text-center">{p2p.error.message}</p>
                )}
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse border border-white/10">
                  <div className="w-2 h-2 bg-nocta-accent rounded-full" />
                </div>
                <h2 className="text-[20px] font-bold text-nocta-text mb-2">Waiting for host</h2>
                <p className="text-[16px] text-nocta-text-muted">
                  The host is currently choosing something to watch.
                </p>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Host URL change bar (hover reveal) */}
      {isHost && hasVideo && (
        <div className="absolute bottom-0 left-0 right-0 z-20 opacity-0 hover:opacity-100
          transition-opacity duration-500 p-4 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              placeholder="Change video..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetVideo()}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl
                px-3 py-2 text-[13px] text-white placeholder-white/25
                focus:outline-none focus:border-white/20 transition-colors duration-300"
            />
            <Button size="sm" onClick={handleSetVideo} disabled={detectVideoSource(urlInput).type === "unknown"}>
              Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
