"use client";

import { Children, useEffect, useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";

export function SelectChevron({ className = "" }) {
  return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

// Preserve existing option markup, change handlers and FormData field names.
export default function WorkbenchSelect({ children, value, defaultValue, onChange, name, disabled, required, className = "", placeholder, ...triggerProps }) {
  const options = Children.toArray(children).filter(Boolean).map((child) => ({
    value: String(child.props.value ?? child.props.children),
    label: child.props.children,
    disabled: child.props.disabled,
  }));
  const initialValue = String(defaultValue ?? options[0]?.value ?? "");
  const [internalValue, setInternalValue] = useState(initialValue);
  const triggerRef = useRef(null);
  const selectedValue = value === undefined ? internalValue : String(value);
  const emptyLabel = options.find((option) => option.value === "")?.label;

  useEffect(() => {
    const form = triggerRef.current?.closest("form");
    const reset = () => setInternalValue(initialValue);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initialValue]);

  function changeValue(nextValue) {
    const next = nextValue === "__empty__" ? "" : nextValue;
    setInternalValue(next);
    const target = { value: next, name };
    onChange?.({ target, currentTarget: target });
  }

  return <>
    {name && <input type="hidden" name={name} value={selectedValue} disabled={disabled} />}
    <Select.Root value={selectedValue || "__empty__"} onValueChange={changeValue} disabled={disabled} required={required}>
    <Select.Trigger {...triggerProps} ref={triggerRef} className={`ui-select-trigger ${className}`}>
      <Select.Value placeholder={placeholder || emptyLabel || "请选择"} />
      <Select.Icon className="ui-select-chevron"><SelectChevron /></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className="ui-select-content" position="popper" sideOffset={6} collisionPadding={12}>
        <Select.ScrollUpButton className="ui-select-scroll ui-select-scroll-up"><SelectChevron /></Select.ScrollUpButton>
        <Select.Viewport className="ui-select-viewport">
          {options.map((option) => <Select.Item className="ui-select-option" key={option.value} value={option.value || "__empty__"} disabled={option.disabled}>
            <Select.ItemText>{option.label}</Select.ItemText>
            <Select.ItemIndicator className="ui-select-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
        <Select.ScrollDownButton className="ui-select-scroll"><SelectChevron /></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
    </Select.Root>
  </>;
}
