import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import Carousel from "./Carousel";
import { requestJson } from "../../api";

jest.mock("../../api", () => ({
  endpoints: { publicCarousel: "/api/public/carousel" },
  requestJson: jest.fn(),
}));

const CACHE_KEY = "public.home.carousel.cache.v1";
const cachedSlide = {
  id: "cached",
  title: "Guardado",
  description: "Disponible sin conexión",
  image: "/logo-panamericana-white-512.png",
};

describe("Carousel offline", () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

  beforeEach(() => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify([cachedSlide]));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    requestJson.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
    if (originalOnLine) Object.defineProperty(navigator, "onLine", originalOnLine);
    else delete navigator.onLine;
  });

  test("usa las diapositivas locales sin solicitar la API", async () => {
    const { container } = render(<Carousel />);

    await waitFor(() => {
      expect(container.querySelector('img[src="/logo-panamericana-white-512.png"]')).toBeInTheDocument();
    });
    expect(requestJson).not.toHaveBeenCalled();
  });

  test("actualiza desde la API al recuperar la conexión", async () => {
    requestJson.mockResolvedValue({ slides: [cachedSlide] });
    render(<Carousel />);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    act(() => window.dispatchEvent(new Event("online")));

    await waitFor(() => expect(requestJson).toHaveBeenCalledTimes(1));
  });
});
