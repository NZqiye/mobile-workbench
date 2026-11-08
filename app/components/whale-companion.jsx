"use client";

import { useEffect, useRef, useState } from "react";
import { bundledAssetUrl } from "../../lib/bundled-assets";

const animationByAction = {
  idle: "idle",
  bone: "snack",
  water: "bubbles",
  toy: "cube",
  stick: "dance",
  gift: "gift",
  cat: "cat",
  reward: "happy",
};

export default function WhaleCompanion({ action, onRest }) {
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failedPlayback, setFailedPlayback] = useState("");
  const source = bundledAssetUrl(`/codex-pets/whale-girl/${animationByAction[action.type] || "idle"}.webm`);
  const playbackKey = `${source}-${action.startedAt || 0}`;
  const interactive = action.type !== "idle";
  const canPlay = motionAllowed && (interactive || !reducedMotion) && failedPlayback !== playbackKey;
  const poster = bundledAssetUrl("/codex-pets/whale-girl/idle.png");

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const update = () => {
      setMotionAllowed(inView && !document.hidden);
      setReducedMotion(preference.matches);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(stageRef.current);
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      videoRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const stage = stageRef.current;
    const bounds = stage.getBoundingClientRect();
    const viewport = stage.closest(".work-area")?.getBoundingClientRect();
    if (bounds.top < Math.max(0, viewport?.top || 0) || bounds.bottom > Math.min(window.innerHeight, viewport?.bottom || window.innerHeight)) {
      stage.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [interactive, action.startedAt]);

  useEffect(() => {
    const video = videoRef.current;
    if (canPlay) video?.play().catch(() => {});
    else video?.pause();
  }, [canPlay, playbackKey]);

  const showVideo = canPlay;
  return (
    <div className="whale-pet-stage" ref={stageRef} aria-hidden="true">
      <img className="whale-pet-media" src={poster} alt="" hidden={showVideo} />
      <video
        key={playbackKey}
        className="whale-pet-media"
        ref={videoRef}
        src={source}
        poster={poster}
        muted
        playsInline
        preload="none"
        loop={action.type === "idle"}
        hidden={!showVideo}
        onCanPlay={() => { if (canPlay) videoRef.current?.play().catch(() => {}); }}
        onEnded={() => onRest()}
        onError={() => {
          setFailedPlayback(playbackKey);
          if (interactive) onRest("互动暂时没加载好，稍后再陪我玩。");
        }}
      />
    </div>
  );
}
