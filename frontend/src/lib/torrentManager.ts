import { ICE_SERVERS } from "../config/media";
import { ENABLE_LOCAL_MEDIA } from "../config/media";

// WebTorrent is imported lazily to avoid top-level os.tmpdir() crash in Next.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WebTorrentCtor: any = null;

async function loadWebTorrent(): Promise<any> {
  if (!WebTorrentCtor) {
    const mod = await import("webtorrent");
    WebTorrentCtor = mod.default;
  }
  return WebTorrentCtor;
}

export class TorrentManager {
  private client: any | null = null;
  private logger = (msg: string, ...args: any[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[TorrentManager] ${msg}`, ...args);
    }
  };

  /**
   * Lazily initialize the singleton client.
   * Ensures exactly ONE WebTorrent client exists in memory.
   */
  private async getClient(): Promise<any> {
    if (!ENABLE_LOCAL_MEDIA) throw new Error("Local media is disabled.");
    
    if (!this.client) {
      this.logger("Initializing global WebTorrent client");
      const WT = await loadWebTorrent();
      this.client = new WT({
        tracker: {
          rtcConfig: {
            iceServers: ICE_SERVERS
          }
        }
      });

      this.client.on("error", (err: any) => {
        this.logger("Global client error", err);
      });
    }
    return this.client;
  }

  /**
   * Seed a file. Automatically cancels/destroys previous torrents.
   */
  async seed(file: File, onSeed: (torrent: any) => void): Promise<any> {
    const client = await this.getClient();
    this.cleanupTorrents();

    this.logger(`Seeding file: ${file.name}`);
    const torrent = client.seed(file, (t: any) => {
      this.logger("Seed successful", t.infoHash);
      onSeed(t);
    });

    return torrent;
  }

  /**
   * Add a magnet URI. Automatically cancels/destroys previous torrents.
   */
  async add(magnetURI: string, onAdd: (torrent: any) => void): Promise<any> {
    const client = await this.getClient();
    this.cleanupTorrents();

    this.logger(`Adding magnet: ${magnetURI.substring(0, 40)}...`);
    const torrent = client.add(magnetURI, (t: any) => {
      this.logger("Add successful", t.infoHash);
      onAdd(t);
    });

    return torrent;
  }

  /**
   * Destroys all active torrents, but keeps the client alive.
   */
  cleanupTorrents() {
    if (!this.client) return;
    
    this.client.torrents.forEach((t: any) => {
      this.logger(`Destroying active torrent: ${t.infoHash}`);
      t.destroy();
    });
    
    if (this.client.torrents.length > 0) {
      this.logger("WARNING: Torrents failed to destroy completely.");
    }
  }

  /**
   * Performs complete teardown of the WebTorrent client and all torrents.
   */
  destroyClient() {
    if (this.client) {
      this.logger("Destroying global WebTorrent client");
      this.client.destroy((err: any) => {
        if (err) this.logger("Error destroying client", err);
      });
      this.client = null;
    }
  }
}

export const torrentManager = new TorrentManager();
