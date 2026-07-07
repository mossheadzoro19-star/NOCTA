export const ENABLE_LOCAL_MEDIA = true;

// 4GB in bytes
export const MAX_LOCAL_MEDIA_SIZE = 4 * 1024 * 1024 * 1024; 

export const SUPPORTED_MIME_TYPES = ["video/mp4"];
export const SUPPORTED_EXTENSIONS = [".mp4"];

// Timeouts (ms)
export const VALIDATION_TIMEOUT_MS = 5000;
export const METADATA_EXTRACTION_TIMEOUT_MS = 10000;
export const SEEDING_TIMEOUT_MS = 15000;

export const DEFAULT_TRACKERS = [
  "wss://tracker.btorrent.xyz",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.webtorrent.dev"
];

// ICE Servers for WebRTC STUN
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" }
];
