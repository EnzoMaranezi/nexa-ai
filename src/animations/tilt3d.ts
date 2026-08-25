import { useEffect, type RefObject } from "react";
import { animate, onScroll } from "animejs";

/**
 * Anime.js — 3D motion driven by scroll position.
 * Each matched child tilts in depth as the section travels through the viewport.
 */
export function useScrollTilt3D(
  ref: RefObject<HTMLElement | null>,
  selector: string,
  options?: { rotateX?: number; rotateY?: number; z?: number; stagger?: number },
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (!targets.length) return;

    const rotateX = options?.rotateX ?? 12;
    const rotateY = options?.rotateY ?? -8;
    const z = options?.z ?? -80;

    root.style.perspective = "1400px";

    const animations = targets.map((el, i) =>
      animate(el, {
        rotateX: [rotateX + i * 1.5, 0],
        rotateY: [rotateY + i * 2, 0],
        z: [z, 0],
        opacity: [0.35, 1],
        ease: "linear",
        autoplay: onScroll({
          target: el,
          enter: "bottom-=40 top",
          leave: "top+=120 bottom",
          sync: 0.6,
        }),
      }),
    );

    return () => {
      animations.forEach((a) => a.revert());
    };
  }, [ref, selector, options?.rotateX, options?.rotateY, options?.z, options?.stagger]);
}
