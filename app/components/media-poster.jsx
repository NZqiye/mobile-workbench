"use client";

import { useEffect, useState } from "react";
import styles from "./media-poster.module.css";

export default function MediaPoster({ item, className = "" }) {
  const [failed, setFailed] = useState([]);
  const poster = item?.posterUrl || "";
  const fallback = item?.posterFallbackUrl || "";
  const backdrop = item?.backdropUrl || "";
  const source = [poster, fallback, backdrop].find(url => url && !failed.includes(url));
  useEffect(() => setFailed([]), [poster, fallback, backdrop]);
  return (
    <div className={`${styles.root} ${className}`}>
      {source ? <img className={styles.image} src={source} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(previous => [...previous, source])} />
        : <span className={styles.placeholder} aria-label="暂无海报">{String(item?.titleZh || item?.title || "影视").slice(0, 1)}</span>}
    </div>
  );
}
