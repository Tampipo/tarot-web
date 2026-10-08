import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Medal } from "../lib/medals";

/** Keep the bubble this far from the viewport edges. */
const GUTTER = 12;

/**
 * The bubble for one medal. Fixed-positioned from its icon's on-screen box, so
 * no scrolling container (the scoreboard's table) can clip it, then nudged
 * back inside the viewport.
 */
function MedalBubble({ medal, anchor }: { medal: Medal; anchor: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const b = ref.current!.getBoundingClientRect();
    const centered = a.left + a.width / 2 - b.width / 2;
    const left = Math.min(Math.max(centered, GUTTER), window.innerWidth - b.width - GUTTER);
    // Below the icon, unless that runs off the bottom of the screen.
    const below = a.bottom + 6;
    const top = below + b.height > window.innerHeight - GUTTER ? a.top - b.height - 6 : below;
    setPos({ left, top });
  }, [anchor]);

  return (
    <div
      ref={ref}
      className="medal-bubble"
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}
    >
      <div className="medal-head">
        <span className="medal-name">
          {medal.icon} {medal.name}
        </span>
        <span className="medal-value muted">{medal.value}</span>
      </div>
      <div className="medal-tagline">“{medal.tagline}”</div>
      <div className="medal-detail muted">{medal.description}</div>
    </div>
  );
}

/**
 * A row of medal icons. Hovering one with a mouse, focusing it, or tapping it
 * opens its description; tapping elsewhere, scrolling or Escape closes it.
 */
export function MedalIcons({ medals, large }: { medals: Medal[]; large?: boolean }) {
  const [open, setOpen] = useState<{ key: string; anchor: HTMLElement } | null>(null);
  const rowRef = useRef<HTMLSpanElement>(null);
  // Set on pointerdown, read on click: a mouse already opened it on hover, so
  // only a touch should toggle it.
  const lastPointer = useRef<string>("mouse");

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const outside = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    // The bubble is pinned to where the icon *was*; any scroll leaves it behind.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (medals.length === 0) return null;
  const shown = open && medals.find((m) => m.key === open.key);

  return (
    <span className={`medal-icons ${large ? "medal-icons-lg" : ""}`.trim()} ref={rowRef}>
      {medals.map((m) => (
        <button
          key={m.key}
          type="button"
          className="medal-icon-btn"
          aria-label={`${m.name}${m.season ? ` (${m.season})` : ""}`}
          aria-expanded={open?.key === m.key}
          onPointerDown={(e) => (lastPointer.current = e.pointerType)}
          onPointerEnter={(e) => e.pointerType === "mouse" && setOpen({ key: m.key, anchor: e.currentTarget })}
          onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(null)}
          // Keyboard focus only: a tap also focuses the button on Android, and
          // opening here would let the click that follows close it again.
          onFocus={(e) =>
            e.currentTarget.matches(":focus-visible") && setOpen({ key: m.key, anchor: e.currentTarget })
          }
          onBlur={() => setOpen(null)}
          onClick={(e) => {
            if (lastPointer.current === "mouse") return;
            const anchor = e.currentTarget;
            setOpen((o) => (o?.key === m.key ? null : { key: m.key, anchor }));
          }}
        >
          {m.icon}
          {m.count !== undefined && m.count > 1 && <span className="medal-count">×{m.count}</span>}
        </button>
      ))}
      {shown && <MedalBubble key={shown.key} medal={shown} anchor={open.anchor} />}
    </span>
  );
}

/**
 * Under a player's name on Stats: this period's places, then a divider, then
 * their tally of past seasons. Either side may be empty.
 */
export function MedalStrip({ current, past }: { current: Medal[]; past: Medal[] }) {
  if (current.length === 0 && past.length === 0) return null;
  return (
    <div className="medal-strip">
      <MedalIcons medals={current} large />
      {current.length > 0 && past.length > 0 && <span className="medal-sep" aria-hidden />}
      <MedalIcons medals={past} large />
    </div>
  );
}
