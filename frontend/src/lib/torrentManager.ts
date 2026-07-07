import WebTorrent from "webtorrent";
import { ICE_SERVERS } from "../config/media";
import { ENABLE_LOCAL_MEDIA } from "../config/media";

export class TorrentManager {
  private client: WebTorrent.Instance | null = null;
  private logger = (msg: string, ...args: any[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[TorrentManager] ${msg}`, ...args);
    }
  };

  /**
   * Lazily initialize the singleton client.
   * Ensures exactly ONE WebTorrent client exists in memory.
   */
  private getClient(): WebTorrent.Instance {
    if (!ENABLE_LOCAL_MEDIA) throw new Error("Local media is disabled.");
    
    if (!this.client) {
      this.logger("Initializing global WebTorrent client");
      this.client = new WebTorrent({
        tracker: {
          rtcConfig: {
            iceServers: ICE_SERVERS
          }
        }
      });

      this.client.on("error", (err) => {
        this.logger("Global client error", err);
      });
    }
    return this.client;
  }

  /**
   * Seed a file. Automatically cancels/destroys previous torrents.
   */
  seed(file: File, onSeed: (torrent: WebTorrent.Torrent) => void): WebTorrent.Torrent {
    const client = this.getClient();
    this.cleanupTorrents(); // Only 1 torrent allowed at a time for this feature

    this.logger(`Seeding file: ${file.name}`);
    const torrent = client.seed(file, (t) => {
      this.logger("Seed successful", t.infoHash);
      onSeed(t);
    });

    return torrent;
  }

  /**
   * Add a magnet URI. Automatically cancels/destroys previous torrents.
   */
  add(magnetURI: string, onAdd: (torrent: WebTorrent.Torrent) => void): WebTorrent.Torrent {
    const client = this.getClient();
    this.cleanupTorrents();

    this.logger(`Adding magnet: ${magnetURI.substring(0, 40)}...`);
    const torrent = client.add(magnetURI, (t) => {
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
    
    this.client.torrents.forEach((t) => {
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
      this.client.destroy((err) => {
        if (err) this.logger("Error destroying client", err);
      });
      this.client = null;
    }
  }
}

export const torrentManager = new TorrentManager();
