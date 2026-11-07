"use client";

import { useLayoutEffect, useRef } from "react";

// Animate the existing surface so navigation never remounts an editor or its draft.
export default function useAppMotion(shellRef, view) {
  const previousView = useRef(view);
  useLayoutEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    const surface = shellRef.current?.querySelector(".content");
    if (!surface?.animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animation = surface.animate(
      preference.matches ? [{ opacity: .88 }, { opacity: 1 }] : [{ opacity: .65, translate: "10px 0" }, { opacity: 1, translate: "0 0" }],
      { duration: preference.matches ? 100 : 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    const cancel = () => animation.cancel();
    preference.addEventListener("change", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancel();
      preference.removeEventListener("change", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, [shellRef, view]);
}
