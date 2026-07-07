export type P2PConnectionState = 
  | "idle"
  | "validating"
  | "connecting"
  | "discovering"
  | "seeding"
  | "buffering"
  | "ready"
  | "playing"
  | "stalled"
  | "timed_out"
  | "degraded"
  | "completed"
  | "destroying"
  | "cancelled"
  | "error";

export type BufferHealth = "good" | "warning" | "critical";

export type ErrorCategory = 
  | "VALIDATION_ERROR" 
  | "BROWSER_UNSUPPORTED" 
  | "TORRENT_FAILURE" 
  | "NETWORK_FAILURE" 
  | "INTERNAL_ERROR";

export interface LocalMediaError {
  code: string;
  category: ErrorCategory;
  message: string;
  debugDetails?: any;
}

export interface MediaMetadata {
  duration: number;
  width: number;
  height: number;
  size: number;
  codecInfo?: string;
}

export interface P2PState {
  sessionId: string | null;
  magnetURI: string | null;
  status: P2PConnectionState;
  downloadSpeed: number;
  uploadSpeed: number;
  peers: number;
  progress: number;
  bufferedSeconds: number;
  bufferHealth: BufferHealth;
  error: LocalMediaError | null;
  metadata: MediaMetadata | null;
}
