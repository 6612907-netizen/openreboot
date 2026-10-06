import type { ReactNode } from "react";
import { copy } from "../i18n/copy";

export const t = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

export function Card({ children, tone }: { children: ReactNode; tone?: "err" }) {
  return <div className={tone === "err" ? "card err" : "card"}>{children}</div>;
}

export function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint ? <em className="muted">{hint}</em> : null}
    </label>
  );
}

/** 多条目输入：对应 ChangeAudit 里那些 string[] 字段。 */
export function ListField({
  label,
  hint,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div className="field">
      <span style={{ display: "block", fontSize: 14, marginBottom: 6 }}>{label}</span>
      {hint ? <div className="muted" style={{ marginBottom: 6 }}>{hint}</div> : null}
      {items.map((v, i) => (
        <div className="row" key={i} style={{ marginBottom: 6 }}>
          <input type="text" value={v} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          <button className="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={copy.audit.remove}>
            ×
          </button>
        </div>
      ))}
      <button className="ghost" onClick={() => onChange([...items, ""])}>
        {copy.audit.addPlaceholder}
      </button>
    </div>
  );
}

/**
 * 选项组。选框的状态变化只由 input 的 change 驱动，label 上**不挂** onClick：
 * label 包住控件时，点文字会让浏览器（和 jsdom）再向 input 转发一次 click，
 * 挂在 label 上的处理器就会被叫两遍——多选是「选中又取消」，看上去点了没反应。
 * UI 冒烟测试第一次真点击时就撞出了这个缺陷。
 */
export function Choice({
  options,
  value,
  onChange,
  multi,
  selected = [],
}: {
  options: readonly { value: string; label: string; hint?: string }[];
  value?: string;
  onChange: (v: string) => void;
  multi?: boolean;
  selected?: string[];
}) {
  return (
    <div className="choices">
      {options.map((o) => {
        const on = multi ? selected.includes(o.value) : value === o.value;
        return (
          <label key={o.value} className={on ? "on" : ""}>
            <input
              type={multi ? "checkbox" : "radio"}
              checked={on}
              onChange={() => onChange(o.value)}
              style={{ accentColor: "var(--accent)", marginTop: 5 }}
            />
            <span>
              {o.label}
              {o.hint ? <div className="muted">{o.hint}</div> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function Pill({ outcome }: { outcome: "done" | "partial" | "missed" }) {
  const label = copy.train.outcomes.find((o) => o.value === outcome)?.label ?? outcome;
  return <span className={`pill ${outcome === "missed" ? "missed" : "done"}`}>{label}</span>;
}
