"use client";

import { useEffect, useRef, useState } from "react";

const animationByAction = {
  idle: "idle",
  bone: "snack",
  water: "bubbles",
  toy: "cube",
  stick: "dance",
  reward: "happy",
};

export default function WhaleCompanion({ action, onRest }) {
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [failedSource, setFailedSource] = useState("");
  const source = `/codex-pets/whale-girl/${animationByAction[action.type] || "idle"}.webm`;
  const poster = "/codex-pets/whale-girl/idle.png";

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const update = () => setMotionAllowed(inView && !document.hidden && !preference.matches);
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
    const video = videoRef.current;
    if (motionAllowed && failedSource !== source) video?.play().catch(() => {});
    else video?.pause();
  }, [motionAllowed, source, action.startedAt, failedSource]);

  const showVideo = motionAllowed && failedSource !== source;
  return (
    <div className="whale-pet-stage" ref={stageRef} aria-hidden="true">
      <img className="whale-pet-media" src={poster} alt="" hidden={showVideo} />
      <video
        key={`${source}-${action.startedAt || 0}`}
        className="whale-pet-media"
        ref={videoRef}
        src={source}
        poster={poster}
        muted
        playsInline
        preload="none"
        loop={action.type === "idle"}
        hidden={!showVideo}
        onCanPlay={() => { if (motionAllowed) videoRef.current?.play().catch(() => {}); }}
        onEnded={onRest}
        onError={() => setFailedSource(source)}
      />
    </div>
  );
}
