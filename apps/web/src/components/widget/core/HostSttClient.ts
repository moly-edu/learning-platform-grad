import type { HostSttResult, SttMode } from "@/components/widget/core/types";

const HOST_STT_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_STT_TIMEOUT_MS || 10000,
);

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function createBrowserSpeechRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") return null;

  const ctor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!ctor) return null;

  return new ctor() as BrowserSpeechRecognition;
}

function normalizeSpeechText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpokenInteger(text: string): number | null {
  const directDigits = text.match(/-?\d+/);
  if (directDigits) {
    const parsed = Number.parseInt(directDigits[0], 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  const normalized = normalizeSpeechText(text);
  if (!normalized) return null;

  const words = normalized.split(" ").filter(Boolean);

  const unitMap: Record<string, number> = {
    khong: 0,
    zero: 0,
    mot: 1,
    one: 1,
    hai: 2,
    two: 2,
    ba: 3,
    three: 3,
    bon: 4,
    tu: 4,
    four: 4,
    nam: 5,
    lam: 5,
    five: 5,
    sau: 6,
    six: 6,
    bay: 7,
    seven: 7,
    tam: 8,
    eight: 8,
    chin: 9,
    nine: 9,
  };

  const englishTens: Record<string, number> = {
    ten: 10,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };

  if (words.length === 1) {
    const singleWord = words[0];
    if (singleWord in unitMap) return unitMap[singleWord];
    if (singleWord in englishTens) return englishTens[singleWord];
  }

  if (words[0] === "muoi") {
    const ones = unitMap[words[1] || ""];
    return 10 + (ones ?? 0);
  }

  const firstUnit = unitMap[words[0] || ""];
  if (firstUnit !== undefined && firstUnit >= 2 && words[1] === "muoi") {
    let value = firstUnit * 10;
    const tailWord =
      words[2] === "linh" || words[2] === "le" ? words[3] : words[2];
    const tail = unitMap[tailWord || ""];
    if (tail !== undefined) value += tail;
    return value;
  }

  const englishTen = englishTens[words[0] || ""];
  if (englishTen !== undefined) {
    const tail = unitMap[words[1] || ""];
    return englishTen + (tail ?? 0);
  }

  return null;
}

let hostSttSession: BrowserSpeechRecognition | null = null;

export function stopHostSttListening() {
  if (!hostSttSession) return;

  const current = hostSttSession;
  hostSttSession = null;

  try {
    current.abort();
  } catch {
    // no-op
  }
}

function normalizeTranscriptByMode(transcript: string, mode: SttMode): string {
  if (mode !== "number") return transcript;

  const parsed = parseSpokenInteger(transcript);
  if (parsed === null) {
    return transcript;
  }

  return String(parsed);
}

export function listenWithHostStt({
  lang,
  timeoutMs,
  mode,
}: {
  lang?: string;
  timeoutMs?: number;
  mode?: SttMode;
}): Promise<HostSttResult> {
  const recognition = createBrowserSpeechRecognition();
  if (!recognition) {
    return Promise.resolve({
      ok: false,
      error:
        "Speech recognition is not available on this host. For Expo host, map STT_LISTEN/STT_STOP to native speech APIs.",
    });
  }

  stopHostSttListening();

  recognition.lang = lang || "vi-VN";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  hostSttSession = recognition;

  const effectiveTimeout = Math.max(1000, timeoutMs || HOST_STT_TIMEOUT_MS);
  const listenMode: SttMode = mode || "free-text";

  return new Promise<HostSttResult>((resolve) => {
    let settled = false;
    let latestTranscript = "";
    let lastError: string | null = null;

    const finish = (result: HostSttResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timerId);

      if (hostSttSession === recognition) {
        hostSttSession = null;
      }

      resolve(result);
    };

    const timerId = window.setTimeout(() => {
      try {
        recognition.stop();
      } catch {
        // no-op
      }

      finish({
        ok: false,
        error: "Speech timeout. Please try again.",
      });
    }, effectiveTimeout);

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      const results = event?.results;
      const startIndex = Number.isFinite(event?.resultIndex)
        ? event.resultIndex
        : 0;

      if (results && typeof results.length === "number") {
        for (let index = startIndex; index < results.length; index++) {
          const result = results[index];
          const transcriptChunk = String(result?.[0]?.transcript ?? "").trim();
          if (!transcriptChunk) continue;

          if (result?.isFinal) {
            finalTranscript += `${transcriptChunk} `;
          } else {
            interimTranscript += `${transcriptChunk} `;
          }
        }
      }

      const mergedTranscript = `${finalTranscript} ${interimTranscript}`.trim();
      if (mergedTranscript) {
        latestTranscript = mergedTranscript;
      }

      if (latestTranscript && finalTranscript) {
        finish({
          ok: true,
          transcript: normalizeTranscriptByMode(latestTranscript, listenMode),
        });
      }
    };

    recognition.onerror = (event: any) => {
      const reason = String(event?.error || "unknown");
      lastError = reason;

      if (reason === "aborted") {
        return;
      }

      finish({
        ok: false,
        error: `Speech recognition error: ${reason}`,
      });
    };

    recognition.onend = () => {
      if (!settled) {
        if (latestTranscript) {
          finish({
            ok: true,
            transcript: normalizeTranscriptByMode(latestTranscript, listenMode),
          });
          return;
        }

        if (lastError) {
          finish({
            ok: false,
            error: `Speech recognition error: ${lastError}`,
          });
          return;
        }

        finish({
          ok: false,
          error: "No speech detected. Please try again.",
        });
      }
    };

    try {
      recognition.start();
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to start STT.",
      });
    }
  });
}
