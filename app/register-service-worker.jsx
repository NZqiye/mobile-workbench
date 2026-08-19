"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        });
        if ("caches" in window) {
          caches.keys().then((keys) => keys.forEach((cacheKey) => caches.delete(cacheKey)));
        }
        return;
      }

      navigator.serviceWorker.register("/sw.js").then((registration) => {
        registration.update();
      });
    }
  }, []);

  return null;
}
