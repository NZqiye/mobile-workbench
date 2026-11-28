"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./media-poster.module.css";

export default function MediaPoster({ item, className = "" }) {
  const [failed, setFailed] = useState([]);
  const [recovered, setRecovered] = useState("");
  const rootRef = useRef(null);
  const attempted = useRef(false);
  const poster = [item?.posterUrl, recovered].find((url) => typeof url === "string" && /^https:\/\/image\.tmdb\.org\/t\/p\//.test(url)) || "";
  const source = failed.includes(poster) ? "" : poster;
  const needsRecovery = !source;
  useEffect(() => { setFailed([]); setRecovered(""); attempted.current = false; }, [item?.posterUrl, item?.tmdbId, item?.tmdbMediaType]);
  useEffect(() => {
    if (!needsRecovery || !item?.tmdbId || attempted.current || !rootRef.current) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      attempted.current = true;
      const params = new URLSearchParams({ id: String(item.tmdbId), type: item.tmdbMediaType === "movie" || item.type === "电影" ? "movie" : "tv" });
      fetch(`/api/media-artwork?${params}`, { signal: controller.signal })
        .then(response => response.ok ? response.json() : {})
        .then(data => { if (!controller.signal.aborted) setRecovered(data.posterUrl || ""); })
        .catch(() => {});
    }, { rootMargin: "160px" });
    observer.observe(rootRef.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, [needsRecovery, item?.tmdbId, item?.tmdbMediaType, item?.type]);
  return (
    <div ref={rootRef} className={`${styles.root} ${className}`}>
      {source ? <img className={styles.image} src={source} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(previous => previous.includes(source) ? previous : [...previous, source])} />
        : <span className={styles.placeholder} aria-label="暂无海报">{String(item?.titleZh || item?.title || "影视").slice(0, 1)}</span>}
    </div>
  );
}
