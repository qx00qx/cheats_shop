import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

const COUNTER_ID = 113660734;
let lastTrackedLocation: string | null = null;

export default function YandexMetrikaTracker() {
  const location = useLocation();

  useEffect(() => {
    const currentLocation = `${location.pathname}${location.search}${location.hash}`;

    if (location.pathname === "/reset-password") {
      lastTrackedLocation = location.pathname;
      return;
    }
    if (lastTrackedLocation === null) {
      lastTrackedLocation = currentLocation;
      return;
    }
    if (lastTrackedLocation === currentLocation) return;

    lastTrackedLocation = currentLocation;
    window.ym?.(COUNTER_ID, "hit", currentLocation, {
      title: document.title,
    });
  }, [location.pathname, location.search, location.hash]);

  return null;
}
