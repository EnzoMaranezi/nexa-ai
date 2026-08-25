import { useState } from "react";
import type { Concept } from "@/types/study";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  weak?: boolean;
}

const POSITIONS = [
  [350, 45],
  [140, 145],
  [350, 155],
  [560, 145],
  [220, 265],
  [480, 265],
] as const;

/** Concept map for the current analysis. Lime marks active or weak nodes only. */
export function KnowledgeMap({ concepts }: { concepts?: Concept[] }) {
  const [active, setActive] = useState<string | null>(null);

  const visibleConcepts = (concepts ?? []).slice(0, POSITIONS.length);
  const layout: Node[] = visibleConcepts.map((concept, index) => {
    const [x, y] = POSITIONS[index]!;
    return {
      id: concept.id,
      label: concept.title,
      x,
      y,
      weak: concept.mastery < 65 || concept.difficulty === "hard",
    };
  });

  const byId = Object.fromEntries(layout.map((n) => [n.id, n]));
  const edges: [string, string][] = visibleConcepts
    .slice(1)
    .map((concept) => [concept.parent && byId[concept.parent] ? concept.parent : visibleConcepts[0]!.id, concept.id]);

  if (layout.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No concept map is available for this material yet.
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 700 320"
      className="h-auto w-full"
      role="img"
      aria-label="Knowledge map of the concepts found in your material"
    >
      {edges.map(([a, b]) => {
        const na = byId[a]!;
        const nb = byId[b]!;
        const lit = active === a || active === b;
        return (
          <line
            key={`${a}-${b}`}
            x1={na.x}
            y1={na.y + 14}
            x2={nb.x}
            y2={nb.y - 14}
            stroke={lit ? "var(--lime)" : "var(--line)"}
            strokeWidth={lit ? 1.4 : 1}
            className="transition-all duration-300"
          />
        );
      })}

      {layout.map((n) => {
        const lit = active === n.id;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            onMouseEnter={() => setActive(n.id)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(n.id)}
            onBlur={() => setActive(null)}
            tabIndex={0}
            role="button"
            aria-label={n.label}
            className="cursor-pointer outline-none"
          >
            <circle
              r={lit ? 7 : 5}
              fill={lit || n.weak ? "var(--lime)" : "var(--surface-3)"}
              stroke={n.weak ? "var(--lime)" : "var(--line)"}
              className="transition-all duration-300"
            />
            <text
              y={26}
              textAnchor="middle"
              className="font-mono"
              fontSize="11"
              fill={lit || n.weak ? "var(--lime)" : "var(--muted-foreground)"}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
