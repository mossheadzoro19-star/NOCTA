import { useEffect, useRef, useCallback } from "react";
import { useRoomStore } from "../stores/roomStore";
import { torrentManager } from "../lib/torrentManager";
import { validateMediaFile } from "../lib/mediaValidator";
import { localMediaService } from "../services/localMediaService";

export function useWebTorrent() {
  const p2p = useRoomStore((s) => s.p2p);
  const setP2PState = useRoomStore((s) => s.setP2PState);
  const isHost = useRoomStore((s) => s.isHost);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Helper to cancel any ongoing async local media operation and reset state.
   */
  const cancelSession = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    torrentManager.cleanupTorrents();
    useRoomStore.getState().cleanupP2P();
  }, []);

  /**
   * Host entry point: Select and stream a local MP4 file.
   */
  const streamLocalFile = useCallback(async (file: File) => {
    if (!isHost) return;

    // 1. Setup new session
    cancelSession();
    const sessionId = crypto.randomUUID();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setP2PState({ sessionId, status: "validating", error: null });

    // 2. Validate
    const result = await validateMediaFile(file, sessionId, signal);
    if (signal.aborted) return;

    if (!result.valid || result.error) {
      setP2PState({ status: "error", error: result.error });
      return;
    }

    setP2PState({ status: "connecting", metadata: result.metadata });

    // 3. Seed
    try {
      await torrentManager.seed(file, (torrent) => {
        if (signal.aborted) {
          torrent.destroy();
          return;
        }

        setP2PState({
          status: "seeding",
          magnetURI: torrent.magnetURI,
          peers: torrent.numPeers
        });

        // Announce to guests via Socket.IO
        localMediaService.emitMagnet(torrent.magnetURI);

        torrent.on("wire", () => {
          if (!signal.aborted) setP2PState({ peers: torrent.numPeers });
        });
      });
    } catch (err: any) {
      if (signal.aborted) return;
      setP2PState({
        status: "error",
        error: {
          code: "TORRENT_SEED_ERROR",
          category: "TORRENT_FAILURE",
          message: "Failed to start streaming server.",
          debugDetails: err.message
        }
      });
    }
  }, [isHost, cancelSession, setP2PState]);

  /**
   * Guest entry point: Discover and download from a magnet URI.
   */
  const connectToHost = useCallback(async (magnetURI: string) => {
    if (isHost) return;

    cancelSession();
    const sessionId = crypto.randomUUID();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setP2PState({ sessionId, status: "discovering", magnetURI, error: null });

    try {
      await torrentManager.add(magnetURI, (torrent) => {
        if (signal.aborted) {
          torrent.destroy();
          return;
        }

        setP2PState({ status: "buffering", peers: torrent.numPeers });

        torrent.on("download", () => {
          if (signal.aborted) return;
          setP2PState({
            downloadSpeed: torrent.downloadSpeed,
            progress: torrent.progress,
            peers: torrent.numPeers
          });
        });

        torrent.on("done", () => {
          if (!signal.aborted) setP2PState({ status: "ready" });
        });
      });
    } catch (err: any) {
      if (signal.aborted) return;
      setP2PState({
        status: "error",
        error: {
          code: "TORRENT_CONNECT_ERROR",
          category: "TORRENT_FAILURE",
          message: "Failed to connect to host stream.",
          debugDetails: err.message
        }
      });
    }
  }, [isHost, cancelSession, setP2PState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelSession();
    };
  }, [cancelSession]);

  return {
    streamLocalFile,
    connectToHost,
    cancelSession,
    p2p
  };
}
