"use client";

import { useEffect, useRef } from "react";

export default function MobileNavigation({ open, pages, activePage, onClose, onSelect, renderIcon }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const workArea = document.querySelector(".work-area");
    const previousOverflow = workArea?.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    if (workArea) workArea.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      if (workArea) workArea.style.overflow = previousOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [open]);

  return <dialog ref={dialogRef} className="mobile-navigation-dialog" aria-labelledby="mobile-navigation-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="mobile-navigation-sheet">
      <div className="mobile-navigation-handle" aria-hidden="true" />
      <header><div><h2 id="mobile-navigation-title">全部栏目</h2><p>当前：{pages.find((page) => page.id === activePage)?.name}</p></div><button type="button" onClick={onClose} aria-label="关闭栏目菜单" autoFocus>×</button></header>
      <nav aria-label="全部栏目" className="mobile-navigation-grid">
        {pages.map((page) => <button type="button" key={page.id} aria-current={activePage === page.id ? "page" : undefined} onClick={() => onSelect(page.id)}>{renderIcon(page.icon)}<span>{page.name}</span>{activePage === page.id && <small>当前</small>}</button>)}
      </nav>
    </section>
  </dialog>;
}
