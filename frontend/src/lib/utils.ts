const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("nocta_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    // Network error — backend is down or unreachable
    throw new Error("Cannot reach server. Please make sure the backend is running.");
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned invalid response (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export function extractInstagramId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export type VideoSource = "youtube" | "instagram" | "file" | "unknown";

export function detectVideoSource(url: string): { type: VideoSource; id?: string } {
  if (!url) return { type: "unknown" };

  // Blob URL or backend upload path or direct video file extension
  if (
    url.startsWith("blob:") || 
    url.includes("/uploads/") || 
    /\.(mp4|webm|ogg|mov)$/i.test(url)
  ) {
    return { type: "file" };
  }

  // YouTube
  const ytId = extractYouTubeId(url);
  if (ytId) return { type: "youtube", id: ytId };

  // Instagram
  const igId = extractInstagramId(url);
  if (igId) return { type: "instagram", id: igId };

  return { type: "unknown" };
}


export function formatTimestamp(date: string | Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateAvatarInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export async function validateCodec(file: File, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/')) {
      return reject(new Error('Invalid file type'));
    }
    
    // Quick reject for known unsupported types
    if (file.type.includes('x-matroska') || file.name.endsWith('.mkv')) {
      return reject(new Error('MKV is not supported. Please use MP4.'));
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    const onAbort = () => {
      cleanup();
      reject(new Error('Aborted'));
    };
    
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort);

    video.onloadedmetadata = () => {
      cleanup();
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    };

    video.onerror = () => {
      cleanup();
      signal.removeEventListener('abort', onAbort);
      reject(new Error('Unsupported video codec or corrupted file'));
    };

    video.src = objectUrl;

    // Timeout
    setTimeout(() => {
      cleanup();
      signal.removeEventListener('abort', onAbort);
      reject(new Error('Validation timeout'));
    }, 5000);
  });
}
