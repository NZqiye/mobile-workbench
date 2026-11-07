"use client";

import { useRef, useState } from "react";
import styles from "./watch-episode-list.module.css";

const pageSize = 40;

export default function WatchEpisodeList({ episodes, checkedEpisodes, onToggle, onWatchThrough, onSave, posterUrl }) {
  const [page, setPage] = useState(() => {
    const next = episodes.findIndex(episode => !checkedEpisodes.has(Number(episode.episodeNumber)));
    return Math.floor(Math.max(0, next) / pageSize);
  });
  const top = useRef(null);
  const [episodeInput, setEpisodeInput] = useState("");
  const [notice, setNotice] = useState("");
  const [highlight, setHighlight] = useState(null);
  const pageCount = Math.ceil(episodes.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = episodes.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  function changePage(next) {
    setPage(Number(next));
    top.current?.scrollIntoView({ block: "start" });
  }
  function locate(markWatched) {
    const number = Number(episodeInput);
    const index = episodes.findIndex(episode => Number(episode.episodeNumber) === number);
    if (!Number.isInteger(number) || index < 0) { setNotice("请输入本季有效的集数。"); return; }
    top.current?.querySelector("input")?.blur();
    setPage(Math.floor(index / pageSize));
    setHighlight(number);
    if (markWatched) {
      onWatchThrough(number);
      setNotice(`已标记看到第 ${number} 集，点击“保存进度”保存。`);
    } else setNotice(`已定位到第 ${number} 集。`);
    requestAnimationFrame(() => {
      if (markWatched) top.current?.scrollIntoView({ block: "start" });
      else top.current?.querySelector(`[data-episode="${number}"]`)?.scrollIntoView({ block: "center" });
    });
  }
  if (!episodes.length) return <p className="watch-rating-status">暂无单集信息。</p>;
  const pager = position => pageCount > 1 && <nav className={styles.pager} aria-label={`${position}集数导航`}>
    <button type="button" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)} aria-label="上一段集数">上一段</button>
    <select value={currentPage} onChange={event => changePage(event.target.value)} aria-label={`${position}选择集数范围`}>
      {Array.from({ length: pageCount }, (_, index) => <option value={index} key={index}>第 {episodes[index * pageSize].episodeNumber}–{episodes[Math.min((index + 1) * pageSize, episodes.length) - 1].episodeNumber} 集</option>)}
    </select>
    <button type="button" disabled={currentPage === pageCount - 1} onClick={() => changePage(currentPage + 1)} aria-label="下一段集数">下一段</button>
  </nav>;
  return <div className={styles.list} ref={top}>
    {pageCount > 1 && <div className={styles.quick}>
      <label htmlFor="watch-episode-jump">选择集数</label>
      <div className={styles.quickActions}><input id="watch-episode-jump" type="text" inputMode="numeric" pattern="[0-9]*" value={episodeInput} onChange={event => { setEpisodeInput(event.target.value); setNotice(""); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); locate(false); } }} placeholder={`1–${episodes[episodes.length - 1].episodeNumber}`} aria-label="输入集数" /><button type="button" onClick={() => locate(false)}>跳到该集</button><button type="button" onClick={() => locate(true)}>已看到这集</button></div>
      <div className={styles.saveRow}><small>“已看到这集”会补齐此前集数</small><button type="button" onClick={() => { onSave(); setNotice("观看进度已保存。"); }}>保存进度</button></div>
      {notice && <p role="status">{notice}</p>}
    </div>}
    {pager("顶部")}
    {visible.map(episode => {
      const number = Number(episode.episodeNumber);
      const image = episode.stillUrl || posterUrl;
      const checked = checkedEpisodes.has(number);
      return <article className={`${styles.episode} ${highlight === number ? styles.highlight : ""}`} key={episode.id || number} data-episode={number}>
        <label className={styles.row}>
          {image ? <img className={styles.image} src={image} alt="" loading="lazy" width="64" height="42" /> : <span className={styles.placeholder}>E{number}</span>}
          <span className={styles.copy}><strong><span className={styles.number}>E{number}</span>{episode.name || `第 ${number} 集`}</strong><small>{[episode.airDate, episode.runtime ? `${episode.runtime} 分钟` : ""].filter(Boolean).join(" · ")}</small></span>
          <input className={styles.checkbox} type="checkbox" aria-label={`第 ${number} 集已看`} checked={checked} onChange={() => onToggle(number)} />
        </label>
        {episode.overview && <details className={styles.overview}><summary>单集简介</summary><p>{episode.overview}</p></details>}
      </article>;
    })}
    {pager("底部")}
  </div>;
}
