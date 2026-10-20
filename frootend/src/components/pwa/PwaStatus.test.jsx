import React from "react";
import { act, render, screen } from "@testing-library/react";
import PwaStatus from "./PwaStatus";

describe("PwaStatus", () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

  const setNavigatorOnline = (value) => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value,
    });
  };

  afterEach(() => {
    jest.useRealTimers();
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    } else {
      delete navigator.onLine;
    }
  });

  test("muestra un aviso persistente y urgente al perder Internet", () => {
    jest.useFakeTimers();
    setNavigatorOnline(true);
    render(<PwaStatus />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const notice = screen.getByRole("alert");
    expect(notice).toHaveAttribute("aria-live", "assertive");
    expect(notice).toHaveAttribute("aria-atomic", "true");
    expect(notice).toHaveTextContent("Sin conexión a Internet.");

    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  test("notifica temporalmente cuando se restablece la conexión", () => {
    jest.useFakeTimers();
    setNavigatorOnline(false);
    render(<PwaStatus />);

    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión a Internet.");

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(notice).toHaveTextContent(
      "Conexión a Internet restablecida. Ya puedes consultar información actualizada."
    );

    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("no anuncia una reconexión si nunca se perdió Internet", () => {
    setNavigatorOnline(true);
    render(<PwaStatus />);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByText(/Conexión a Internet restablecida/i)).not.toBeInTheDocument();
  });
});
