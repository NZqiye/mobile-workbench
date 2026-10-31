"use client";

import { anniversaryIconGroups, anniversaryIcons } from "../../lib/anniversary-icons";

export default function AnniversaryIconPicker({ value, onChange }) {
  return <div className="daybook-icon-library">
    {anniversaryIconGroups.map((group) => <fieldset key={group}>
      <legend>{group}</legend>
      <div className="daybook-icon-options">
        {anniversaryIcons.filter((icon) => icon.group === group).map((icon) => <button type="button" key={icon.id} aria-label={`使用${icon.label}图标`} aria-pressed={value === icon.id} onClick={() => onChange(icon.id)}>
          <img src={icon.image} width="40" height="40" alt="" loading="lazy" />
          <span>{icon.label}</span>
        </button>)}
      </div>
    </fieldset>)}
    <a href="https://www.thiings.co/things" target="_blank" rel="noreferrer">图标来自 Thiings</a>
  </div>;
}
