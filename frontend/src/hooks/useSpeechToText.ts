import { useCallback, useEffect, useRef, useState } from "react";

// The browser's speech-recognition feature isn't in TypeScript's built-in
// types yet, so these are the small parts we use.
interface RecognitionResult {
  0: { transcript: string };
}

interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  error: string;
}

interface RecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => RecognitionInstance;

// Chrome and Edge call it webkitSpeechRecognition; Safari too.
function getRecognitionConstructor(): RecognitionConstructor | null {
  const browserWindow = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
}

export type SpeechError =
  | "blocked" // microphone permission was refused
  | "no-microphone"
  | "no-speech" // nothing was said
  | "network"
  | "other";

interface Options {
  // Called while the student speaks, with ALL the words spoken so far
  onText: (spokenText: string) => void;
  onError: (error: SpeechError) => void;
}

// Speech-to-text using the browser's built-in feature (no extra service and no
// Gemini quota used).
export function useSpeechToText({ onText, onError }: Options) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<RecognitionInstance | null>(null);

  // Always call the latest versions of the callbacks
  const callbacksRef = useRef({ onText, onError });
  useEffect(() => {
    callbacksRef.current = { onText, onError };
  });

  const isSupported = getRecognitionConstructor() !== null;

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition || recognitionRef.current) return;

    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true; // keep listening until the student stops
    recognition.interimResults = true; // show words while they are being spoken

    recognition.onresult = (event) => {
      let spoken = "";
      for (let i = 0; i < event.results.length; i++) {
        spoken += event.results[i][0].transcript;
      }
      callbacksRef.current.onText(spoken);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return; // we stopped it ourselves
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        callbacksRef.current.onError("blocked");
      } else if (event.error === "audio-capture") {
        callbacksRef.current.onError("no-microphone");
      } else if (event.error === "no-speech") {
        callbacksRef.current.onError("no-speech");
      } else if (event.error === "network") {
        callbacksRef.current.onError("network");
      } else {
        callbacksRef.current.onError("other");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      callbacksRef.current.onError("other");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // Stop listening if the student leaves the page
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { isSupported, isListening, start, stop };
}