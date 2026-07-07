import { MAX_LOCAL_MEDIA_SIZE, SUPPORTED_MIME_TYPES, SUPPORTED_EXTENSIONS, VALIDATION_TIMEOUT_MS } from "../config/media";
import { MediaMetadata, LocalMediaError } from "../types/localMedia";

export interface ValidationResult {
  valid: boolean;
  metadata?: MediaMetadata;
  error?: LocalMediaError;
}

/**
 * Pure function to validate media file.
 * Must NOT interact with React, Socket, or Webtorrent.
 */
export async function validateMediaFile(file: File, sessionId: string, signal: AbortSignal): Promise<ValidationResult> {
  // 1. Extension check
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: {
        code: "UNSUPPORTED_EXTENSION",
        category: "VALIDATION_ERROR",
        message: `Only ${SUPPORTED_EXTENSIONS.join(", ")} files are supported.`
      }
    };
  }

  // 2. MIME type check
  if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: {
        code: "UNSUPPORTED_MIME",
        category: "VALIDATION_ERROR",
        message: `MIME type ${file.type} is not supported. Please use standard MP4.`
      }
    };
  }

  // 3. File size check
  if (file.size > MAX_LOCAL_MEDIA_SIZE) {
    const sizeInGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
    const maxInGB = (MAX_LOCAL_MEDIA_SIZE / (1024 * 1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: {
        code: "FILE_TOO_LARGE",
        category: "VALIDATION_ERROR",
        message: `File is ${sizeInGB}GB. Maximum allowed size is ${maxInGB}GB.`
      }
    };
  }

  // 4, 5, 6. Preload, canplay, metadata extraction
  return new Promise((resolve) => {
    if (signal.aborted) {
      return resolve({ valid: false, error: { code: "CANCELLED", category: "INTERNAL_ERROR", message: "Validation cancelled." } });
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    
    let objectUrl: string | null = null;
    
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (err) {
      return resolve({ valid: false, error: { code: "BLOB_ERROR", category: "BROWSER_UNSUPPORTED", message: "Browser cannot read this file." } });
    }

    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    const onAbort = () => {
      cleanup();
      resolve({ valid: false, error: { code: "CANCELLED", category: "INTERNAL_ERROR", message: "Validation cancelled." } });
    };

    signal.addEventListener("abort", onAbort);

    video.oncanplay = () => {
      cleanup();
      signal.removeEventListener("abort", onAbort);
      resolve({
        valid: true,
        metadata: {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file.size
        }
      });
    };

    video.onerror = () => {
      cleanup();
      signal.removeEventListener("abort", onAbort);
      resolve({
        valid: false,
        error: {
          code: "CODEC_ERROR",
          category: "VALIDATION_ERROR",
          message: "Unsupported video codec or corrupted file. Ensure video is H.264/AAC."
        }
      });
    };

    timeoutId = setTimeout(() => {
      cleanup();
      signal.removeEventListener("abort", onAbort);
      resolve({
        valid: false,
        error: {
          code: "TIMEOUT",
          category: "VALIDATION_ERROR",
          message: "Validation timed out. The file might be corrupted."
        }
      });
    }, VALIDATION_TIMEOUT_MS);

    video.src = objectUrl;
  });
}
