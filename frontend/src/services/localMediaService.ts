import { Socket } from "socket.io-client";
import { ENABLE_LOCAL_MEDIA } from "../config/media";

export class LocalMediaService {
  private socket: Socket | null = null;
  private logger = (msg: string, ...args: any[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[LocalMediaService] ${msg}`, ...args);
    }
  };

  attach(socket: Socket) {
    if (!ENABLE_LOCAL_MEDIA) return;
    this.socket = socket;
    this.logger("Attached to socket", socket.id);
  }

  detach() {
    this.socket = null;
    this.logger("Detached");
  }

  // --- Emitters (Host) ---
  emitMagnet(magnetURI: string) {
    if (!this.socket) return;
    this.logger("Emitting magnet", magnetURI);
    this.socket.emit("local:magnet", { magnetURI });
  }

  emitPlay(currentTime: number) {
    if (!this.socket) return;
    this.logger("Emitting play", currentTime);
    this.socket.emit("local:play", { currentTime });
  }

  emitPause(currentTime: number) {
    if (!this.socket) return;
    this.logger("Emitting pause", currentTime);
    this.socket.emit("local:pause", { currentTime });
  }

  emitSeek(targetTime: number) {
    if (!this.socket) return;
    this.logger("Emitting seek", targetTime);
    this.socket.emit("local:seek", { targetTime });
  }

  // --- Emitters (Guest) ---
  emitHeartbeat(currentTime: number, bufferHealth: string) {
    if (!this.socket) return;
    // this.logger("Emitting heartbeat", { currentTime, bufferHealth });
    this.socket.emit("local:heartbeat", { currentTime, bufferHealth });
  }

  // --- Subscribers ---
  onMagnet(callback: (data: { magnetURI: string }) => void) {
    if (!this.socket) return () => {};
    this.socket.on("local:magnet", callback);
    return () => this.socket?.off("local:magnet", callback);
  }

  onPlay(callback: (data: { currentTime: number; serverTimestamp: number }) => void) {
    if (!this.socket) return () => {};
    this.socket.on("local:play", callback);
    return () => this.socket?.off("local:play", callback);
  }

  onPause(callback: (data: { currentTime: number }) => void) {
    if (!this.socket) return () => {};
    this.socket.on("local:pause", callback);
    return () => this.socket?.off("local:pause", callback);
  }

  onSeek(callback: (data: { targetTime: number; serverTimestamp: number }) => void) {
    if (!this.socket) return () => {};
    this.socket.on("local:seek", callback);
    return () => this.socket?.off("local:seek", callback);
  }
}

// Singleton instance
export const localMediaService = new LocalMediaService();
