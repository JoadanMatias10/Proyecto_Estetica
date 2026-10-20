import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import VoiceSearchButton from "./VoiceSearchButton";

describe("VoiceSearchButton", () => {
  const originalSpeechRecognition = window.SpeechRecognition;
  const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

  afterEach(() => {
    jest.useRealTimers();
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
    if (originalMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
    } else {
      delete navigator.mediaDevices;
    }
  });

  test("mantiene la búsqueda manual cuando el navegador no soporta voz", () => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;

    render(<VoiceSearchButton onTranscript={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Buscar productos por voz" })).toBeDisabled();
    expect(screen.getByText(/no está disponible en este navegador/i)).toBeInTheDocument();
  });

  test("entrega el texto reconocido al buscador existente", () => {
    let recognitionInstance;
    let stopCalls = 0;
    class RecognitionMock {
      constructor() {
        recognitionInstance = this;
      }

      start() {
        this.onstart?.();
      }

      stop() {
        stopCalls += 1;
        this.onend?.();
      }

      abort() {}
    }

    window.SpeechRecognition = RecognitionMock;
    const onTranscript = jest.fn();
    render(<VoiceSearchButton onTranscript={onTranscript} />);

    fireEvent.click(screen.getByRole("button", { name: "Buscar productos por voz" }));
    expect(screen.getByText(/Micrófono activo/i)).toBeInTheDocument();
    expect(recognitionInstance.continuous).toBe(true);
    expect(recognitionInstance.interimResults).toBe(true);

    act(() => {
      recognitionInstance.onspeechend();
    });
    expect(stopCalls).toBe(0);

    act(() => {
      const finalResult = [{ transcript: "Shampoo para cabello" }];
      finalResult.isFinal = true;
      recognitionInstance.onresult({ results: [finalResult] });
    });

    expect(stopCalls).toBe(1);
    expect(onTranscript).toHaveBeenCalledWith("Shampoo para cabello");
    expect(screen.getByText(/Resultado:.*Shampoo para cabello/i)).toBeInTheDocument();
  });

  test("abre el micrófono seleccionado y entrega su pista al reconocimiento", async () => {
    const audioTrack = {
      contentHint: "",
      kind: "audio",
      label: "Matriz de micrófonos",
      readyState: "live",
      stop: jest.fn(),
    };
    const mediaStream = {
      getAudioTracks: () => [audioTrack],
      getTracks: () => [audioTrack],
    };
    const getUserMedia = jest.fn().mockResolvedValue(mediaStream);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        enumerateDevices: jest.fn().mockResolvedValue([
          { deviceId: "microphone-1", kind: "audioinput", label: "Matriz de micrófonos" },
        ]),
        getUserMedia,
        removeEventListener: jest.fn(),
      },
    });

    let recognitionInstance;
    let receivedTrack;
    class RecognitionMock {
      constructor() {
        recognitionInstance = this;
      }

      start(track) {
        receivedTrack = track;
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {}
    }

    window.SpeechRecognition = RecognitionMock;
    render(<VoiceSearchButton onTranscript={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Buscar productos por voz" }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(receivedTrack).toBe(audioTrack);
    expect(audioTrack.contentHint).toBe("speech-recognition");
    expect(await screen.findByText(/Micrófono conectado: Matriz de micrófonos/i)).toBeInTheDocument();

    act(() => {
      const finalResult = [{ transcript: "Shampoo" }];
      finalResult.isFinal = true;
      recognitionInstance.onresult({ results: [finalResult] });
    });

    expect(audioTrack.stop).toHaveBeenCalledTimes(1);
  });

  test("espera brevemente a que una pista silenciada vuelva a emitir audio", async () => {
    let unmuteListener;
    const audioTrack = {
      addEventListener: jest.fn((eventName, listener) => {
        if (eventName === "unmute") unmuteListener = listener;
      }),
      contentHint: "",
      enabled: true,
      kind: "audio",
      label: "Matriz de micrófonos",
      muted: true,
      readyState: "live",
      removeEventListener: jest.fn(),
      stop: jest.fn(),
    };
    const mediaStream = {
      getAudioTracks: () => [audioTrack],
      getTracks: () => [audioTrack],
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        enumerateDevices: jest.fn().mockResolvedValue([]),
        getUserMedia: jest.fn().mockResolvedValue(mediaStream),
        removeEventListener: jest.fn(),
      },
    });

    const start = jest.fn();
    class RecognitionMock {
      start(track) {
        start(track);
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {}
    }

    window.SpeechRecognition = RecognitionMock;
    render(<VoiceSearchButton onTranscript={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Buscar productos por voz" }));
    await waitFor(() => expect(audioTrack.addEventListener).toHaveBeenCalledWith("unmute", expect.any(Function)));
    expect(start).not.toHaveBeenCalled();

    act(() => {
      audioTrack.muted = false;
      unmuteListener();
    });

    await waitFor(() => expect(start).toHaveBeenCalledWith(audioTrack));
    expect(screen.getByText(/Micrófono conectado: Matriz de micrófonos/i)).toBeInTheDocument();
  });

  test("explica cómo reactivar en Windows una pista que permanece silenciada", async () => {
    jest.useFakeTimers();
    const audioTrack = {
      addEventListener: jest.fn(),
      contentHint: "",
      enabled: true,
      kind: "audio",
      label: "Matriz de micrófonos",
      muted: true,
      readyState: "live",
      removeEventListener: jest.fn(),
      stop: jest.fn(),
    };
    const mediaStream = {
      getAudioTracks: () => [audioTrack],
      getTracks: () => [audioTrack],
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        enumerateDevices: jest.fn().mockResolvedValue([]),
        getUserMedia: jest.fn().mockResolvedValue(mediaStream),
        removeEventListener: jest.fn(),
      },
    });

    const recognitionConstructor = jest.fn();
    class RecognitionMock {
      constructor() {
        recognitionConstructor();
      }

      abort() {}
    }

    window.SpeechRecognition = RecognitionMock;
    render(<VoiceSearchButton onTranscript={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Buscar productos por voz" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(audioTrack.addEventListener).toHaveBeenCalledWith("unmute", expect.any(Function));

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(
      screen.getByText(
        /Windows tiene silenciado el dispositivo.*tecla con el micrófono tachado.*Configuración > Sistema > Sonido > Entrada/i
      )
    ).toBeInTheDocument();
    expect(recognitionConstructor).not.toHaveBeenCalled();
    expect(audioTrack.stop).toHaveBeenCalledTimes(1);
  });

  test("distingue una pista inválida de un reconocedor ya activo", async () => {
    const createMediaDevices = (audioTrack) => ({
      addEventListener: jest.fn(),
      enumerateDevices: jest.fn().mockResolvedValue([]),
      getUserMedia: jest.fn().mockResolvedValue({
        getAudioTracks: () => [audioTrack],
        getTracks: () => [audioTrack],
      }),
      removeEventListener: jest.fn(),
    });

    const invalidTrack = {
      enabled: true,
      kind: "audio",
      label: "Micrófono desconectado",
      muted: false,
      readyState: "ended",
      stop: jest.fn(),
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: createMediaDevices(invalidTrack),
    });

    const recognitionConstructor = jest.fn();
    class RecognitionMock {
      constructor() {
        recognitionConstructor();
      }

      abort() {}
    }

    window.SpeechRecognition = RecognitionMock;
    const firstRender = render(<VoiceSearchButton onTranscript={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar productos por voz" }));

    expect(await screen.findByText(/pista de audio inválida o inactiva/i)).toBeInTheDocument();
    expect(recognitionConstructor).not.toHaveBeenCalled();
    firstRender.unmount();

    const validTrack = {
      contentHint: "",
      enabled: true,
      kind: "audio",
      label: "Matriz de micrófonos",
      muted: false,
      readyState: "live",
      stop: jest.fn(),
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: createMediaDevices(validTrack),
    });

    const start = jest.fn(() => {
      throw new DOMException("El reconocedor ya inició.", "InvalidStateError");
    });
    class BusyRecognitionMock {
      start(track) {
        start(track);
      }

      abort() {}
    }

    window.SpeechRecognition = BusyRecognitionMock;
    render(<VoiceSearchButton onTranscript={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar productos por voz" }));

    expect(await screen.findByText(/reconocimiento de voz ya está activo/i)).toBeInTheDocument();
    expect(start).toHaveBeenCalledWith(validTrack);
    expect(validTrack.stop).toHaveBeenCalledTimes(1);
  });
});
