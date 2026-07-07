import { useEffect, useRef } from "react";
import { useRoomStore } from "@/stores/roomStore";
import { localMediaService } from "@/services/localMediaService";
import { useWebTorrent } from "@/hooks/useWebTorrent";

export default function LocalPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isHost = useRoomStore((s) => s.isHost);
  const p2p = useRoomStore((s) => s.p2p);
  const setP2PState = useRoomStore((s) => s.setP2PState);
  
  const { p2p: p2pState } = useWebTorrent(); // Ensure lifecycle bindings are active

  const ignoreStateChange = useRef(false);

  // Sync Video Events (Host -> Guest)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isHost || p2p.status !== "ready" && p2p.status !== "playing") return;

    const onPlay = () => {
      if (ignoreStateChange.current) return;
      localMediaService.emitPlay(vid.currentTime);
      setP2PState({ status: "playing" });
    };
    const onPause = () => {
      if (ignoreStateChange.current) return;
      localMediaService.emitPause(vid.currentTime);
      setP2PState({ status: "ready" });
    };
    const onSeeked = () => {
      if (ignoreStateChange.current) return;
      localMediaService.emitSeek(vid.currentTime);
    };

    vid.addEventListener("play", onPlay);
    vid.addEventListener("pause", onPause);
    vid.addEventListener("seeked", onSeeked);

    return () => {
      vid.removeEventListener("play", onPlay);
      vid.removeEventListener("pause", onPause);
      vid.removeEventListener("seeked", onSeeked);
    };
  }, [isHost, p2p.status, setP2PState]);

  // Sync Listeners (Guest receives from Host)
  useEffect(() => {
    if (isHost) return;

    const unsubPlay = localMediaService.onPlay(({ currentTime, serverTimestamp }) => {
      ignoreStateChange.current = true;
      const elapsed = (Date.now() - serverTimestamp) / 1000;
      const adjusted = currentTime + elapsed;

      if (videoRef.current) {
        videoRef.current.currentTime = adjusted;
        videoRef.current.play().catch(e => console.warn("Autoplay blocked:", e));
      }
      setP2PState({ status: "playing" });
      setTimeout(() => { ignoreStateChange.current = false; }, 500);
    });

    const unsubPause = localMediaService.onPause(({ currentTime }) => {
      ignoreStateChange.current = true;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = currentTime;
      }
      setP2PState({ status: "ready" });
      setTimeout(() => { ignoreStateChange.current = false; }, 500);
    });

    const unsubSeek = localMediaService.onSeek(({ targetTime, serverTimestamp }) => {
      ignoreStateChange.current = true;
      const elapsed = (Date.now() - serverTimestamp) / 1000;
      const adjusted = targetTime + elapsed;
      if (videoRef.current) {
        videoRef.current.currentTime = adjusted;
      }
      setTimeout(() => { ignoreStateChange.current = false; }, 500);
    });

    return () => {
      unsubPlay();
      unsubPause();
      unsubSeek();
    };
  }, [isHost, setP2PState]);

  // Heartbeat & Buffer tracking
  useEffect(() => {
    if (isHost || !videoRef.current || p2p.status === "idle" || p2p.status === "error") return;

    const interval = setInterval(() => {
      const vid = videoRef.current;
      if (!vid) return;

      // Calculate buffered seconds
      let bufferedSeconds = 0;
      if (vid.buffered.length > 0) {
        bufferedSeconds = vid.buffered.end(vid.buffered.length - 1) - vid.currentTime;
      }

      setP2PState({ bufferedSeconds });

      // Determine buffer health
      let bufferHealth: "good" | "warning" | "critical" = "good";
      if (bufferedSeconds < 2) bufferHealth = "critical";
      else if (bufferedSeconds < 10) bufferHealth = "warning";

      setP2PState({ bufferHealth });

      if (p2p.status === "playing" || p2p.status === "ready") {
        localMediaService.emitHeartbeat(vid.currentTime, bufferHealth);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isHost, p2p.status, setP2PState]);

  return (
    <video
      ref={videoRef}
      id="local-media-video"
      controls={true}
      className="absolute inset-0 w-full h-full object-contain"
    />
  );
}
