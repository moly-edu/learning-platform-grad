import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

export interface HostTtsResult {
  ok: boolean;
  error?: string;
}

const HOST_TTS_ENDPOINT = (process.env.EXPO_PUBLIC_TTS_ENDPOINT || "").trim();
const HOST_TTS_TIMEOUT_MS = Number(
  process.env.EXPO_PUBLIC_TTS_TIMEOUT_MS || 25000,
);
const HOST_TTS_TOKEN = (process.env.EXPO_PUBLIC_TTS_BEARER_TOKEN || "").trim();

type ExpoAudioPlayer = ReturnType<typeof createAudioPlayer>;

let hostAudio: ExpoAudioPlayer | null = null;
let hostAudioStatusSub: { remove: () => void } | null = null;

function buildAbsoluteUrl(urlOrPath: string, base: string): string {
  try {
    return new URL(urlOrPath, base).toString();
  } catch {
    return urlOrPath;
  }
}

function extractEventId(responseJson: any): string | null {
  if (typeof responseJson?.event_id === "string") return responseJson.event_id;
  return null;
}

function extractAudioCandidate(payload: any): string | null {
  if (payload == null) return null;

  if (typeof payload === "string") {
    return payload;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractAudioCandidate(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof payload === "object") {
    if (typeof payload.url === "string") return payload.url;
    if (typeof payload.path === "string") return payload.path;
    if (typeof payload.name === "string") return payload.name;

    if (payload.data !== undefined) {
      const foundInData = extractAudioCandidate(payload.data);
      if (foundInData) return foundInData;
    }

    if (payload.value !== undefined) {
      const foundInValue = extractAudioCandidate(payload.value);
      if (foundInValue) return foundInValue;
    }
  }

  return null;
}

function parseLastJsonDataFromSse(raw: string): any | null {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"));

  for (let i = lines.length - 1; i >= 0; i--) {
    const jsonText = lines[i].replace(/^data:\s*/, "");
    try {
      return JSON.parse(jsonText);
    } catch {
      // Skip malformed lines and continue backward.
    }
  }

  return null;
}

export function stopHostTtsPlayback() {
  if (!hostAudio) return;

  const current = hostAudio;
  hostAudio = null;
  hostAudioStatusSub?.remove();
  hostAudioStatusSub = null;

  try {
    current.pause();
    current.currentTime = 0;
    current.remove();
  } catch {
    // Ignore cleanup errors when player is already disposed.
  }
}

async function playHostAudio(audioSrc: string): Promise<void> {
  stopHostTtsPlayback();

  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "duckOthers",
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });

  const audio = createAudioPlayer({ uri: audioSrc }, { updateInterval: 120 });
  hostAudio = audio;

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      hostAudioStatusSub?.remove();
      hostAudioStatusSub = null;

      if (hostAudio === audio) {
        hostAudio = null;
      }

      try {
        audio.remove();
      } catch {
        // Ignore player disposal errors.
      }
    };

    hostAudioStatusSub = audio.addListener("playbackStatusUpdate", (status) => {
      if (hostAudio !== audio) {
        cleanup();
        reject(new Error("Host audio stopped"));
        return;
      }

      if (status.didJustFinish) {
        cleanup();
        resolve();
      }
    });

    try {
      audio.play();
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error("Host audio play failed"));
    }
  });
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function synthesizeWithHostTts(
  text: string,
): Promise<HostTtsResult> {
  if (!HOST_TTS_ENDPOINT) {
    return {
      ok: false,
      error:
        "Host chưa cấu hình EXPO_PUBLIC_TTS_ENDPOINT nên chưa gọi được TTS API.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (HOST_TTS_TOKEN) {
    headers.Authorization = `Bearer ${HOST_TTS_TOKEN}`;
  }

  try {
    const submitRes = await fetchWithTimeout(
      HOST_TTS_ENDPOINT,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ data: [text] }),
      },
      HOST_TTS_TIMEOUT_MS,
    );

    if (!submitRes.ok) {
      return {
        ok: false,
        error: `TTS submit lỗi ${submitRes.status}: ${submitRes.statusText}`,
      };
    }

    const submitJson = await submitRes.json();
    const eventId = extractEventId(submitJson);

    if (!eventId) {
      const directCandidate = extractAudioCandidate(submitJson);
      if (!directCandidate) {
        return {
          ok: false,
          error: "TTS submit không trả event_id hợp lệ.",
        };
      }

      const directAudioSrc = directCandidate.startsWith("data:audio")
        ? directCandidate
        : buildAbsoluteUrl(directCandidate, HOST_TTS_ENDPOINT);

      await playHostAudio(directAudioSrc);

      return {
        ok: true,
      };
    }

    const resultUrl = `${HOST_TTS_ENDPOINT}/${encodeURIComponent(eventId)}`;
    const resultRes = await fetchWithTimeout(
      resultUrl,
      {
        method: "GET",
        headers: HOST_TTS_TOKEN
          ? { Authorization: headers.Authorization as string }
          : undefined,
      },
      HOST_TTS_TIMEOUT_MS,
    );

    if (!resultRes.ok) {
      return {
        ok: false,
        error: `TTS result lỗi ${resultRes.status}: ${resultRes.statusText}`,
      };
    }

    const raw = await resultRes.text();
    const ssePayload = parseLastJsonDataFromSse(raw);
    const candidate = extractAudioCandidate(ssePayload);

    if (!candidate) {
      return {
        ok: false,
        error: "TTS result không chứa dữ liệu audio hợp lệ.",
      };
    }

    if (candidate.startsWith("data:audio")) {
      await playHostAudio(candidate);
      return { ok: true };
    }

    const audioUrl = buildAbsoluteUrl(candidate, HOST_TTS_ENDPOINT);
    await playHostAudio(audioUrl);

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Host TTS failed",
    };
  }
}
