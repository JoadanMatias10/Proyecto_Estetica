import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import Contactos from "./Contactos";
import { fetchPublicCompanyInfo } from "../../utils/publicCatalogApi";

jest.mock("../../utils/publicCatalogApi", () => ({
  fetchPublicCompanyInfo: jest.fn(),
}));

describe("Contactos - mapa y conectividad", () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

  const setNavigatorOnline = (value) => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value,
    });
  };

  beforeEach(() => {
    fetchPublicCompanyInfo.mockResolvedValue({
      mapLat: 19.4326,
      mapLng: -99.1332,
      mapZoom: 16,
      direccion: "Sucursal de prueba",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    } else {
      delete navigator.onLine;
    }
  });

  test("no carga Google Maps sin conexión y lo restaura al reconectar", async () => {
    setNavigatorOnline(false);
    render(<Contactos />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Este mapa requiere conexión a Internet"
    );
    expect(screen.queryByTitle("Mapa de Estetica Panamericana")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir en Google Maps" })).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    const map = await screen.findByTitle("Mapa de Estetica Panamericana");
    expect(map).toHaveAttribute(
      "src",
      "https://www.google.com/maps?q=19.4326,-99.1332&z=16&output=embed"
    );
    expect(screen.queryByText("Mapa no disponible sin conexión")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchPublicCompanyInfo).toHaveBeenCalledTimes(2));
  });

  test("retira el iframe en cuanto se pierde la conexión", async () => {
    setNavigatorOnline(true);
    render(<Contactos />);

    expect(await screen.findByTitle("Mapa de Estetica Panamericana")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.queryByTitle("Mapa de Estetica Panamericana")).not.toBeInTheDocument();
    expect(screen.getByText("Mapa no disponible sin conexión")).toBeInTheDocument();
  });
});
