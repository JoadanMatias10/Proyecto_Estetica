import React, { useCallback, useEffect, useRef, useState } from "react";

const LISTENING_TIMEOUT_MS = 15000;
const MUTED_TRACK_WAIT_MS = 1000;
const VOICE_LEVEL_THRESHOLD = 4;
const MUTED_MICROPHONE_MESSAGE =
  "Windows tiene silenciado el dispositivo. Pulsa la tecla con el micrófono tachado (o Fn + esa tecla) hasta apagar la luz, o actívalo en Configuración > Sistema > Sonido > Entrada.";
const INVALID_AUDIO_TRACK_MESSAGE =
  "El micrófono entregó una pista de audio inválida o inactiva. Selecciona otra entrada e intenta de nuevo.";

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getRecognitionErrorMessage(code, microphoneState = {}) {
  const { canMeasureAudio = false, signalDetected = false, microphoneLabel = "" } = microphoneState;
  const microphoneName = microphoneLabel ? ` “${microphoneLabel}”` : "";

  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permiso de micrófono denegado. Puedes seguir escribiendo tu búsqueda.";
    case "audio-capture":
      return "No se encontró un micrófono disponible.";
    case "network":
      return "El reconocimiento de voz necesita conexión a Internet en este navegador.";
    case "no-speech":
      if (canMeasureAudio && signalDetected) {
        return `El micrófono${microphoneName} sí recibió audio, pero Chrome no logró transcribirlo. Intenta decir una sola palabra.`;
      }
      if (canMeasureAudio) {
        return `El micrófono${microphoneName} no está enviando señal. Elige otra entrada en la lista de micrófonos.`;
      }
      return "Chrome no recibió voz del micrófono seleccionado. Revisa la entrada de audio e intenta nuevamente.";
    case "aborted":
      return "";
    default:
      return "No fue posible reconocer la voz. Intenta nuevamente.";
  }
}

function getCaptureErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Chrome bloqueó el micrófono para este sitio. Permítelo desde el icono junto a la dirección.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "El micrófono seleccionado ya no está disponible. Elige otra entrada.";
    case "NotReadableError":
    case "AbortError":
      return "No se pudo abrir el micrófono. Cierra otras aplicaciones que puedan estar utilizándolo.";
    case "MutedAudioTrackError":
      return MUTED_MICROPHONE_MESSAGE;
    case "InvalidStateError":
      return INVALID_AUDIO_TRACK_MESSAGE;
    default:
      return "No se pudo conectar con el micrófono seleccionado.";
  }
}

function getRecognitionStartErrorMessage(error, audioTrack) {
  if (audioTrack?.muted) return MUTED_MICROPHONE_MESSAGE;
  if (
    audioTrack &&
    (audioTrack.kind !== "audio" || audioTrack.readyState !== "live" || audioTrack.enabled === false)
  ) {
    return INVALID_AUDIO_TRACK_MESSAGE;
  }
  if (error?.name === "InvalidStateError") {
    return "El reconocimiento de voz ya está activo. Espera un momento e intenta de nuevo.";
  }
  return "No se pudo iniciar el reconocimiento de voz. Intenta nuevamente.";
}

function waitForAudioTrackUnmuted(audioTrack) {
  if (!audioTrack?.muted) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    const finish = (isUnmuted) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      audioTrack.removeEventListener?.("unmute", handleUnmute);
      resolve(isUnmuted);
    };

    const handleUnmute = () => finish(true);
    audioTrack.addEventListener?.("unmute", handleUnmute);
    timeoutId = window.setTimeout(() => finish(!audioTrack.muted), MUTED_TRACK_WAIT_MS);

    // Evita perder un evento unmute ocurrido entre la primera lectura y el listener.
    if (!audioTrack.muted) finish(true);
  });
}

function getDeviceLabel(device, index) {
  return device.label || `Micrófono ${index + 1}`;
}

export default function VoiceSearchButton({ onTranscript }) {
  const Recognition = getSpeechRecognitionConstructor();
  const recognitionRef = useRef(null);
  const sessionRef = useRef(0);
  const startingRef = useRef(false);
  const timeoutRef = useRef(null);
  const lastTranscriptRef = useRef("");
  const outcomeRef = useRef("idle");
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const signalDetectedRef = useRef(false);
  const canMeasureAudioRef = useRef(false);
  const activeMicrophoneLabelRef = useRef("");

  const [status, setStatus] = useState(Recognition ? "idle" : "unsupported");
  const [message, setMessage] = useState(
    Recognition ? "" : "La búsqueda por voz no está disponible en este navegador."
  );
  const [audioInputs, setAudioInputs] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [activeMicrophoneLabel, setActiveMicrophoneLabel] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  const clearListeningTimeout = useCallback(() => {
    if (!timeoutRef.current) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const stopMicrophoneCapture = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => {});
    }

    const mediaStream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    mediaStream?.getTracks().forEach((track) => track.stop());
  }, []);

  const refreshAudioInputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === "audioinput");
      setAudioInputs(inputs);
      setSelectedDeviceId((current) =>
        current && inputs.some((device) => device.deviceId === current) ? current : ""
      );
      return inputs;
    } catch (_error) {
      return [];
    }
  }, []);

  const startAudioLevelMonitor = useCallback((mediaStream) => {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor || !window.requestAnimationFrame) {
      canMeasureAudioRef.current = false;
      return;
    }

    try {
      const audioContext = new AudioContextConstructor();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const silentGain = audioContext.createGain();
      analyser.fftSize = 1024;
      const samples = new Uint8Array(analyser.fftSize);
      let lastVisualUpdate = 0;
      let consecutiveSignalFrames = 0;

      analyser.smoothingTimeConstant = 0.25;
      silentGain.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silentGain);
      silentGain.connect(audioContext.destination);
      audioContextRef.current = audioContext;
      canMeasureAudioRef.current = true;
      void audioContext.resume?.().catch(() => {});

      const measure = (timestamp) => {
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let index = 0; index < samples.length; index += 1) {
          const normalizedSample = (samples[index] - 128) / 128;
          sumSquares += normalizedSample * normalizedSample;
        }

        const rms = Math.sqrt(sumSquares / samples.length);
        const level = Math.min(100, Math.round(rms * 500));
        consecutiveSignalFrames = level >= VOICE_LEVEL_THRESHOLD
          ? consecutiveSignalFrames + 1
          : 0;
        if (consecutiveSignalFrames >= 3) signalDetectedRef.current = true;

        if (timestamp - lastVisualUpdate >= 80) {
          lastVisualUpdate = timestamp;
          setAudioLevel(level);
        }
        animationFrameRef.current = window.requestAnimationFrame(measure);
      };

      animationFrameRef.current = window.requestAnimationFrame(measure);
    } catch (_error) {
      canMeasureAudioRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refreshAudioInputs();
    const mediaDevices = navigator.mediaDevices;
    const handleDeviceChange = () => void refreshAudioInputs();
    mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);

    return () => {
      mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, [refreshAudioInputs]);

  useEffect(() => () => {
    sessionRef.current += 1;
    clearListeningTimeout();
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    stopMicrophoneCapture();
  }, [clearListeningTimeout, stopMicrophoneCapture]);

  const startRecognition = async () => {
    if (!Recognition) {
      setStatus("unsupported");
      setMessage("La búsqueda por voz no está disponible en este navegador.");
      return;
    }

    if (startingRef.current) return;

    if (recognitionRef.current) {
      outcomeRef.current = "processing";
      setStatus("processing");
      setMessage("Procesando voz...");
      recognitionRef.current.stop();
      return;
    }

    startingRef.current = true;
    const sessionId = ++sessionRef.current;
    setStatus("starting");
    setMessage("Conectando con el micrófono...");
    setAudioLevel(0);
    signalDetectedRef.current = false;
    canMeasureAudioRef.current = false;
    lastTranscriptRef.current = "";
    outcomeRef.current = "starting";

    let audioTrack = null;
    let microphoneLabel = "";

    if (navigator.mediaDevices?.getUserMedia) {
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
      };

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });

        if (sessionRef.current !== sessionId) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = mediaStream;
        audioTrack = mediaStream.getAudioTracks()[0] || null;

        if (!audioTrack) {
          throw new DOMException("No hay una pista de audio disponible.", "NotFoundError");
        }

        if (
          audioTrack.kind !== "audio" ||
          audioTrack.readyState !== "live" ||
          audioTrack.enabled === false
        ) {
          throw new DOMException("La pista de audio no está activa.", "InvalidStateError");
        }

        const isTrackUnmuted = await waitForAudioTrackUnmuted(audioTrack);
        if (sessionRef.current !== sessionId) {
          stopMicrophoneCapture();
          return;
        }
        if (!isTrackUnmuted || audioTrack.muted) {
          throw new DOMException("El dispositivo está silenciado.", "MutedAudioTrackError");
        }

        try {
          audioTrack.contentHint = "speech-recognition";
        } catch (_error) {
          // Algunos navegadores no permiten cambiar contentHint; la captura continúa normalmente.
        }

        microphoneLabel = audioTrack.label || "Micrófono predeterminado";
        activeMicrophoneLabelRef.current = microphoneLabel;
        setActiveMicrophoneLabel(microphoneLabel);
        startAudioLevelMonitor(mediaStream);
        void refreshAudioInputs();
      } catch (error) {
        startingRef.current = false;
        stopMicrophoneCapture();
        outcomeRef.current = "error";
        setStatus("error");
        setMessage(getCaptureErrorMessage(error));
        return;
      }
    }

    const recognition = new Recognition();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      startingRef.current = false;
      outcomeRef.current = "listening";
      setStatus("listening");
      setMessage(
        microphoneLabel
          ? `Micrófono conectado: ${microphoneLabel}. Habla ahora...`
          : "Micrófono activo. Habla ahora..."
      );
      clearListeningTimeout();
      timeoutRef.current = window.setTimeout(() => {
        if (recognitionRef.current !== recognition) return;
        outcomeRef.current = lastTranscriptRef.current ? "success" : "error";
        setStatus(lastTranscriptRef.current ? "success" : "error");
        setMessage(
          lastTranscriptRef.current
            ? `Resultado: “${lastTranscriptRef.current}”`
            : getRecognitionErrorMessage("no-speech", {
                canMeasureAudio: canMeasureAudioRef.current,
                signalDetected: signalDetectedRef.current,
                microphoneLabel: activeMicrophoneLabelRef.current,
              })
        );
        recognition.stop();
      }, LISTENING_TIMEOUT_MS);
    };

    recognition.onaudiostart = () => {
      setMessage(
        microphoneLabel
          ? `Micrófono conectado: ${microphoneLabel}. Habla ahora...`
          : "Micrófono activo. Habla ahora..."
      );
    };

    recognition.onsoundstart = () => {
      setMessage("Audio detectado. Sigue hablando...");
    };

    recognition.onspeechstart = () => {
      outcomeRef.current = "listening";
      setStatus("listening");
      setMessage("Voz detectada. Sigue hablando...");
    };

    recognition.onspeechend = () => {
      if (outcomeRef.current === "success") return;
      outcomeRef.current = "processing";
      setStatus("processing");
      setMessage("Procesando voz...");
    };

    recognition.onresult = (event) => {
      let transcript = "";
      let hasFinalResult = false;

      for (let index = 0; index < (event.results?.length || 0); index += 1) {
        const result = event.results[index];
        transcript += `${String(result?.[0]?.transcript || "").trim()} `;
        hasFinalResult = hasFinalResult || Boolean(result?.isFinal);
      }

      transcript = transcript.trim();
      if (!transcript) return;

      lastTranscriptRef.current = transcript;
      onTranscript(transcript);

      if (hasFinalResult) {
        outcomeRef.current = "success";
        clearListeningTimeout();
        setStatus("success");
        setMessage(`Resultado: “${transcript}”`);
        recognition.stop();
        return;
      }

      outcomeRef.current = "listening";
      setStatus("listening");
      setMessage(`Escuchando: “${transcript}”`);
    };

    recognition.onerror = (event) => {
      clearListeningTimeout();
      const errorMessage = getRecognitionErrorMessage(event.error, {
        canMeasureAudio: canMeasureAudioRef.current,
        signalDetected: signalDetectedRef.current,
        microphoneLabel: activeMicrophoneLabelRef.current,
      });
      if (!errorMessage) return;
      outcomeRef.current = "error";
      setStatus("error");
      setMessage(errorMessage);
    };

    recognition.onnomatch = () => {
      outcomeRef.current = "error";
      setStatus("error");
      setMessage("Se escuchó audio, pero no se pudo convertir en texto. Intenta una frase más corta.");
    };

    recognition.onend = () => {
      startingRef.current = false;
      clearListeningTimeout();
      recognitionRef.current = null;
      stopMicrophoneCapture();
      setAudioLevel(0);

      if (lastTranscriptRef.current && outcomeRef.current !== "error") {
        outcomeRef.current = "success";
        setStatus("success");
        setMessage(`Resultado: “${lastTranscriptRef.current}”`);
        return;
      }

      if (outcomeRef.current !== "error") {
        outcomeRef.current = "error";
        setStatus("error");
        setMessage("La escucha terminó sin texto. Elige otra entrada de micrófono e intenta de nuevo.");
      }
    };

    recognitionRef.current = recognition;
    try {
      if (audioTrack) {
        recognition.start(audioTrack);
      } else {
        recognition.start();
      }
    } catch (trackError) {
      const canFallBack = trackError?.name === "TypeError" || trackError?.name === "NotSupportedError";
      let startError = trackError;
      let errorTrack = audioTrack;
      if (canFallBack) {
        try {
          stopMicrophoneCapture();
          canMeasureAudioRef.current = false;
          activeMicrophoneLabelRef.current = "";
          setActiveMicrophoneLabel("");
          recognition.start();
          return;
        } catch (fallbackError) {
          startError = fallbackError;
          errorTrack = null;
        }
      }

      const startErrorMessage = getRecognitionStartErrorMessage(startError, errorTrack);
      stopMicrophoneCapture();
      startingRef.current = false;
      clearListeningTimeout();
      recognitionRef.current = null;
      outcomeRef.current = "error";
      setStatus("error");
      setMessage(startErrorMessage);
    }
  };

  const isStarting = status === "starting";
  const isListening = status === "listening";
  const isProcessing = status === "processing";
  const isCapturing = isStarting || isListening || isProcessing;
  const buttonLabel = isListening
    ? "Detener búsqueda por voz"
    : isStarting
      ? "Conectando con el micrófono"
      : isProcessing
        ? "Procesando búsqueda por voz"
        : "Buscar productos por voz";
  const selectableInputs = audioInputs.filter((device) => device.deviceId !== "default");

  return (
    <div className="flex min-w-11 max-w-72 flex-col items-end">
      <button
        type="button"
        onClick={startRecognition}
        disabled={status === "unsupported" || isStarting || isProcessing}
        aria-label={buttonLabel}
        aria-pressed={isListening}
        title={buttonLabel}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
          isListening
            ? "animate-pulse border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-200"
            : status === "error"
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-violet-200 bg-white text-violet-600 hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isCapturing && canMeasureAudioRef.current && (
        <div className="mt-1 w-44" aria-label={`Nivel de entrada del micrófono: ${audioLevel}%`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-[width] ${audioLevel >= VOICE_LEVEL_THRESHOLD ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${Math.max(2, audioLevel)}%` }}
            />
          </div>
          <span className="mt-0.5 block truncate text-right text-[10px] text-slate-500" title={activeMicrophoneLabel}>
            Entrada: {activeMicrophoneLabel || "predeterminada"}
          </span>
        </div>
      )}

      {selectableInputs.length > 0 && (
        <label className="mt-1 flex max-w-64 items-center gap-1 text-[11px] text-slate-600">
          <span className="shrink-0">Micrófono:</span>
          <select
            value={selectedDeviceId}
            onChange={(event) => setSelectedDeviceId(event.target.value)}
            disabled={isCapturing}
            className="min-w-0 max-w-44 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[11px] focus:border-violet-400 focus:outline-none disabled:bg-slate-100"
            aria-label="Seleccionar micrófono"
          >
            <option value="">Predeterminado</option>
            {selectableInputs.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {getDeviceLabel(device, index)}
              </option>
            ))}
          </select>
        </label>
      )}

      {message && (
        <span
          className={`mt-1 max-w-72 text-right text-xs ${status === "error" || status === "unsupported" ? "text-amber-700" : "text-violet-600"}`}
          aria-live="polite"
        >
          {message}
        </span>
      )}
    </div>
  );
}
