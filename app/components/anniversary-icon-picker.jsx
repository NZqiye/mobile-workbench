"use client";

import { useState } from "react";
import { anniversaryIconGroups, anniversaryIcons } from "../../lib/anniversary-icons";
import { bundledAssetUrl } from "../../lib/bundled-assets";

export default function AnniversaryIconPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const matches = anniversaryIcons.filter((icon) => `${icon.label} ${icon.group}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="daybook-icon-library">
    <label className="icon-search"><span>搜索纪念日图标</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="生日、旅行、礼物…" /></label>
    <div className="icon-search-results">
    {!matches.length && <p className="icon-search-empty">没有找到图标，试试其他名字。</p>}
    {anniversaryIconGroups.filter((group) => matches.some((icon) => icon.group === group)).map((group) => <fieldset key={group}>
      <legend>{group}</legend>
      <div className="daybook-icon-options">
        {matches.filter((icon) => icon.group === group).map((icon) => <button type="button" key={icon.id} title={icon.label} aria-label={`使用${icon.label}图标`} aria-pressed={value === icon.id} onClick={() => onChange(icon.id)}>
          <img src={bundledAssetUrl(icon.image)} width="44" height="44" alt="" loading="lazy" />
        </button>)}
      </div>
    </fieldset>)}
    </div>
  </div>;
}
