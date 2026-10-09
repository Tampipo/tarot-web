import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  HOUSE_RULES,
  type HouseRule,
  type RouletteContext,
  type SpunHouseRule,
} from "../lib/houseRules";
import { Button } from "./ui";

const SEGMENT_COLORS = [
  "#4f46e5",
  "#8b5cf6",
  "#059669",
  "#e11d48",
  "#f59e0b",
  "#0ea5e9",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

// Long enough to read as a proper spin, short enough nobody's waiting around.
const SPIN_MS = 4200;
const EXTRA_SPINS = 6;
const ICON_RADIUS = 92;

const NO_CONTEXT: RouletteContext = { seatedNames: [], leaderName: null, seatedStandings: [] };

/** Each rule's slice as a [start, end) arc in degrees, clockwise from the top — sized by weight, not by count. */
function computeSlices(weights: number[]): { start: number; end: number; mid: number }[] {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return weights.map((w) => {
    const start = (acc / total) * 360;
    acc += w;
    const end = (acc / total) * 360;
    return { start, end, mid: (start + end) / 2 };
  });
}

/** Picks an index at random, proportional to its weight. */
function pickWeightedIndex(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return weights.length - 1; // floating-point safety net
}

/**
 * The rotation (in degrees) that lands a slice centered on `mid` under the
 * fixed top pointer, spinning forward from wherever the wheel currently sits
 * — so two spins in a row always keep turning the same way instead of
 * snapping back.
 */
function targetRotation(current: number, mid: number): number {
  const targetMod = (360 - mid + 360) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  const forward = (targetMod - currentMod + 360) % 360;
  return current + EXTRA_SPINS * 360 + forward;
}

export function Roulette({
  rules = HOUSE_RULES,
  context = NO_CONTEXT,
  onResult,
  onAction,
}: {
  rules?: HouseRule[];
  context?: RouletteContext;
  onResult?: (rule: SpunHouseRule) => void;
  /** Fired when the result card's own action button (if the rule has one) is clicked. */
  onAction?: (rule: SpunHouseRule) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpunHouseRule | null>(null);
  const [spinCount, setSpinCount] = useState(0);
  // Closing the dialog or navigating away mid-spin unmounts this component;
  // without cancelling the pending timeout, it would still fire afterwards
  // and silently apply a rule the user never saw land.
  const spinTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current !== null) window.clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  const weights = useMemo(() => rules.map((r) => r.weight ?? 1), [rules]);
  const slices = useMemo(() => computeSlices(weights), [weights]);

  const background = useMemo(
    () =>
      `conic-gradient(${rules
        .map(
          (r, i) =>
            `${r.color ?? SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${slices[i].start}deg ${slices[i].end}deg`,
        )
        .join(", ")})`,
    [rules, slices],
  );

  // Randomized once per landed result, not on every render — otherwise the
  // burst would reshuffle mid-fall on an unrelated re-render.
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        drift: (Math.random() - 0.5) * 160,
        delay: Math.random() * 0.25,
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      })),
    [spinCount],
  );

  function spin() {
    if (spinning) return;
    setResult(null);
    setSpinning(true);
    const index = pickWeightedIndex(weights);
    setRotation((r) => targetRotation(r, slices[index].mid));
    spinTimeoutRef.current = window.setTimeout(() => {
      spinTimeoutRef.current = null;
      setSpinning(false);
      const rule = rules[index];
      const spun: SpunHouseRule = {
        id: rule.id,
        emoji: rule.emoji,
        label: rule.label,
        description: rule.resolveDescription ? rule.resolveDescription(context) : rule.description,
        actionLabel: rule.actionLabel,
      };
      setResult(spun);
      setSpinCount((c) => c + 1);
      onResult?.(spun);
    }, SPIN_MS);
  }

  return (
    <div className="roulette">
      <div className="wheel-outer">
        <div className="wheel-pointer" />
        <div
          className={`wheel ${spinning ? "wheel-spinning" : ""}`}
          style={{ background, transform: `rotate(${rotation}deg)` }}
        >
          {rules.map((r, i) => (
            <span
              key={r.id}
              className="wheel-seg-icon"
              style={{ transform: `rotate(${slices[i].mid}deg) translate(0, -${ICON_RADIUS}px)` }}
            >
              <span style={{ display: "inline-block", transform: `rotate(${-slices[i].mid}deg)` }}>
                {r.emoji}
              </span>
            </span>
          ))}
        </div>
        <div className="wheel-hub" />
      </div>

      <Button
        variant="primary"
        block
        className="roulette-spin"
        onClick={spin}
        disabled={spinning}
      >
        {spinning ? "Spinning…" : "Launch the roulette for next game"}
      </Button>

      {result && !spinning && (
        <div key={spinCount} className="roulette-result">
          <div className="confetti" aria-hidden="true">
            {confettiPieces.map((p) =>
              result.id === "great-equalizer" ? (
                <span
                  key={p.id}
                  className="confetti-piece confetti-emoji"
                  style={
                    {
                      left: `${p.left}%`,
                      animationDelay: `${p.delay}s`,
                      "--drift": `${p.drift}px`,
                    } as CSSProperties
                  }
                >
                  ☭
                </span>
              ) : (
                <span
                  key={p.id}
                  className="confetti-piece"
                  style={
                    {
                      left: `${p.left}%`,
                      background: p.color,
                      animationDelay: `${p.delay}s`,
                      "--drift": `${p.drift}px`,
                    } as CSSProperties
                  }
                />
              ),
            )}
          </div>
          <div className="roulette-result-card">
            <div className="roulette-result-emoji">{result.emoji}</div>
            <div className="roulette-result-label">{result.label}</div>
            <div className="roulette-result-desc muted">{result.description}</div>
            {result.actionLabel && (
              <Button
                variant="primary"
                block
                style={{ marginTop: 14 }}
                onClick={() => onAction?.(result)}
              >
                {result.actionLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
