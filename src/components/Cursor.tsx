import { useEffect, useState } from "react";
import { motion } from "motion/react";

/** Discreet custom cursor — desktop, pointer-fine devices only. */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [hot, setHot] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);

    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      const t = e.target as HTMLElement | null;
      setHot(Boolean(t?.closest("a, button, [role='button'], [tabindex]")));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  if (!enabled) return null;

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[90] hidden rounded-full border border-lime/70 mix-blend-difference lg:block"
      animate={{
        x: pos.x - (hot ? 18 : 6),
        y: pos.y - (hot ? 18 : 6),
        width: hot ? 36 : 12,
        height: hot ? 36 : 12,
        opacity: hot ? 1 : 0.6,
      }}
      transition={{ type: "spring", stiffness: 700, damping: 42, mass: 0.4 }}
      aria-hidden
    />
  );
}
