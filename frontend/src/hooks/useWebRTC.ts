"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocketContext } from "@/context/SocketProvider";
import { useRoomStore } from "@/stores/roomStore";

export function useWebRTC() {
  const { socket } = useSocketContext();
  const participants = useRoomStore((s) => s.participants);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const createPeer = useCallback(
    (targetSocketId: string, stream: MediaStream | null, isInitiator: boolean) => {
      // ponytail: using native RTCPeerConnection over heavy libs like simple-peer
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      if (stream) {
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      }

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit("webrtc:ice-candidate", {
            targetSocketId,
            candidate: JSON.stringify(event.candidate),
          });
        }
      };

      peer.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "closed") {
          peer.close();
          peersRef.current.delete(targetSocketId);
          setRemoteStream(null);
        }
      };

      if (isInitiator) {
        peer
          .createOffer()
          .then((offer) => peer.setLocalDescription(offer))
          .then(() => {
            socket?.emit("webrtc:offer", {
              targetSocketId,
              sdp: JSON.stringify(peer.localDescription),
            });
          });
      }

      peersRef.current.set(targetSocketId, peer);
      return peer;
    },
    [socket]
  );

  useEffect(() => {
    if (!socket) return;

    socket.on("webrtc:offer", async ({ senderSocketId, sdp }) => {
      const desc = new RTCSessionDescription(JSON.parse(sdp));
      const peer = createPeer(senderSocketId, localStream, false);
      await peer.setRemoteDescription(desc);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("webrtc:answer", {
        targetSocketId: senderSocketId,
        sdp: JSON.stringify(peer.localDescription),
      });
    });

    socket.on("webrtc:answer", async ({ senderSocketId, sdp }) => {
      const peer = peersRef.current.get(senderSocketId);
      if (peer) {
        const desc = new RTCSessionDescription(JSON.parse(sdp));
        await peer.setRemoteDescription(desc);
      }
    });

    socket.on("webrtc:ice-candidate", async ({ senderSocketId, candidate }) => {
      const peer = peersRef.current.get(senderSocketId);
      if (peer) {
        const cand = new RTCIceCandidate(JSON.parse(candidate));
        await peer.addIceCandidate(cand);
      }
    });

    socket.on("webrtc:peer-disconnected", ({ socketId }) => {
      const peer = peersRef.current.get(socketId);
      if (peer) {
        peer.close();
        peersRef.current.delete(socketId);
        setRemoteStream(null);
      }
    });

    return () => {
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice-candidate");
      socket.off("webrtc:peer-disconnected");
    };
  }, [socket, createPeer, localStream]);

  // Auto-connect to new users if we are currently sharing
  useEffect(() => {
    if (!socket || !isSharing || !localStream) return;

    const handleUserJoined = ({ user, participants: updatedParticipants }: any) => {
      const newPart = updatedParticipants.find((p: any) => p.userId === user.userId);
      if (newPart && newPart.socketId !== socket.id) {
        createPeer(newPart.socketId, localStream, true);
      }
    };

    socket.on("room:user-joined", handleUserJoined);
    return () => {
      socket.off("room:user-joined", handleUserJoined);
    };
  }, [socket, isSharing, localStream, createPeer]);

  const startScreenShare = async () => {
    try {
      useRoomStore.getState().addToast('Tip: For apps like VLC, share "Entire Screen" to avoid black screens', "info");
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsSharing(true);

      const currentParticipants = useRoomStore.getState().participants;
      currentParticipants.forEach((p) => {
        if (p.socketId && p.socketId !== socket?.id) {
          createPeer(p.socketId, stream, true);
        }
      });

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      return true;
    } catch (err) {
      console.error("Screen share failed", err);
      return false;
    }
  };

  const stopScreenShare = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setIsSharing(false);

    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    setRemoteStream(null);
  };

  return { startScreenShare, stopScreenShare, isSharing, localStream, remoteStream };
}
