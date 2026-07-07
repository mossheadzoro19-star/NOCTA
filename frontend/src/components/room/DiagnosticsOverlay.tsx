"use client";

import { useRoomStore } from "@/stores/roomStore";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function DiagnosticsOverlay() {
  const showDiagnostics = useRoomStore((s) => s.showDiagnostics);
  const p2p = useRoomStore((s) => s.p2p);
  const playback = useRoomStore((s) => s.playback);

  if (process.env.NODE_ENV !== "development" || !showDiagnostics) return null;

  return (
    <div className="absolute top-4 right-4 z-50 bg-black/80 border border-white/10 rounded-lg p-4 w-64 text-[11px] font-mono text-white/80 pointer-events-none backdrop-blur-md">
      <h3 className="text-white font-semibold mb-2 text-[12px]">P2P Diagnostics</h3>
      
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-white/50">Session ID:</span>
          <span className="truncate w-24 text-right" title={p2p.sessionId || "None"}>
            {p2p.sessionId ? p2p.sessionId.split('-')[0] + '...' : "None"}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Status:</span>
          <span className={`capitalize ${p2p.status === 'error' ? 'text-red-400' : p2p.status === 'ready' || p2p.status === 'playing' ? 'text-green-400' : 'text-yellow-400'}`}>
            {p2p.status}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/50">Peers:</span>
          <span>{p2p.peers}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Download:</span>
          <span>{formatBytes(p2p.downloadSpeed)}/s</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Upload:</span>
          <span>{formatBytes(p2p.uploadSpeed)}/s</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Progress:</span>
          <span>{(p2p.progress * 100).toFixed(1)}%</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Time:</span>
          <span>{playback.currentTime.toFixed(1)}s</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Buffered:</span>
          <span>{p2p.bufferedSeconds.toFixed(1)}s</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Buffer Health:</span>
          <span className={`capitalize ${p2p.bufferHealth === 'good' ? 'text-green-400' : p2p.bufferHealth === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>
            {p2p.bufferHealth}
          </span>
        </div>

        {p2p.error && (
          <div className="mt-2 pt-2 border-t border-white/10 text-red-400 leading-tight">
            Error: {p2p.error.message}
          </div>
        )}
      </div>
    </div>
  );
}
