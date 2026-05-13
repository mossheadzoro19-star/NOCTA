"use client";

import { useEffect, useRef, useState } from "react";
import WebTorrent from "webtorrent";
import { useRoomStore } from "@/stores/roomStore";
import { useSocketContext } from "@/context/SocketProvider";

export default function TorrentPlayer({
  file,
  videoRef,
}: {
  file?: File | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const { socket } = useSocketContext();
  const isHost = useRoomStore((s) => s.isHost);
  const p2p = useRoomStore((s) => s.p2p);
  const setP2PState = useRoomStore((s) => s.setP2PState);

  const clientRef = useRef<any>(null);
  const torrentRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const initTorrent = async () => {
      if (abortSignal.aborted) return;
      
      // Initialize WebTorrent client with basic STUN
      clientRef.current = new WebTorrent({
        tracker: {
          rtcConfig: {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
          }
        }
      });

      clientRef.current.on('error', (err: any) => {
        if (!abortSignal.aborted) {
          setP2PState({ status: 'error', errorReason: err.message || 'Torrent client error' });
        }
      });

      if (isHost && file) {
        setP2PState({ status: 'seeding' });
        clientRef.current.seed(file, (torrent: any) => {
          if (abortSignal.aborted) return;
          torrentRef.current = torrent;
          
          setP2PState({ 
            magnetURI: torrent.magnetURI,
            peers: torrent.numPeers
          });
          
          socket?.emit("p2p:magnet", { magnetURI: torrent.magnetURI });

          torrent.on('wire', () => {
            if (!abortSignal.aborted) setP2PState({ peers: torrent.numPeers });
          });

          // Stream to video tag
          torrent.files[0].renderTo(videoRef.current, { autoplay: false });
        });
      } else if (!isHost && p2p.magnetURI) {
        setP2PState({ status: 'discovering' });
        clientRef.current.add(p2p.magnetURI, (torrent: any) => {
          if (abortSignal.aborted) return;
          torrentRef.current = torrent;
          
          setP2PState({ status: 'buffering', peers: torrent.numPeers });

          torrent.on('download', () => {
            if (abortSignal.aborted) return;
            setP2PState({ 
              downloadSpeed: torrent.downloadSpeed,
              progress: torrent.progress,
              peers: torrent.numPeers
            });
          });

          // Stream to video tag
          const videoFile = torrent.files.find((f: any) => f.name.endsWith('.mp4') || f.name.endsWith('.webm'));
          if (videoFile && videoRef.current) {
            videoFile.renderTo(videoRef.current, { autoplay: false });
          } else {
             setP2PState({ status: 'error', errorReason: 'No supported video found in torrent.' });
          }
        });
      }
    };

    initTorrent();

    return () => {
      abortControllerRef.current?.abort();
      
      try {
        if (torrentRef.current) torrentRef.current.destroy();
        if (clientRef.current) clientRef.current.destroy();
      } catch (err) {
        console.error("Cleanup error:", err);
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [isHost, file, p2p.magnetURI, socket, setP2PState, videoRef]);

  // Handle Video Lifecycle Events
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const handleWaiting = () => setP2PState({ status: 'buffering' });
    const handleCanPlay = () => setP2PState({ status: 'ready' });
    const handleError = () => setP2PState({ status: 'error', errorReason: 'Playback failed.' });

    vid.addEventListener('waiting', handleWaiting);
    vid.addEventListener('canplay', handleCanPlay);
    vid.addEventListener('error', handleError);

    return () => {
      vid.removeEventListener('waiting', handleWaiting);
      vid.removeEventListener('canplay', handleCanPlay);
      vid.removeEventListener('error', handleError);
    };
  }, [videoRef, setP2PState]);

  return null; // Headless component, just manages torrent lifecycle
}
