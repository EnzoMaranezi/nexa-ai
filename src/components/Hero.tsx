import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { HeroInterface } from "./HeroInterface";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";

function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const mouse = { x: 0.5, y: 0.5 };
    const dots = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.1 + 0.3,
      s: Math.random() * 0.00012 + 0.00004,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.y -= d.s;
        if (d.y < -0.02) d.y = 1.02;
        const px = (d.x + (mouse.x - 0.5) * 0.02) * w;
        const py = (d.y + (mouse.y - 0.5) * 0.02) * h;
        ctx.beginPath();
        ctx.arc(px, py, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.r > 1.1 ? "rgba(212,255,79,0.5)" : "rgba(245,245,240,0.28)";
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [reduced]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

export function Hero() {
  const { user } = useAuth();
  const { t } = useI18n();
  const headline = t("landing.headline").split(" ");

  return (
    <section id="top" className="relative grain min-h-[100svh] overflow-hidden pt-28 md:pt-32">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, color-mix(in oklab, var(--lime) 8%, transparent) 0%, transparent 60%), radial-gradient(80% 60% at 80% 30%, color-mix(in oklab, var(--surface-3) 90%, transparent) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <ParticleField />

      <div className="shell relative grid gap-16 pb-24 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6 lg:pt-10">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="label-mono"
          >
            {t("landing.agent")}
          </motion.p>

          <h1 className="display mt-7 max-w-[15ch]">
            {headline.map((word, i) => (
              <motion.span
                key={word + i}
                className="mr-[0.24em] inline-block"
                initial={{ opacity: 0, y: "0.35em", filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 1,
                  delay: 0.35 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {word.includes("AI") ? <span className="editorial text-lime">{word}</span> : word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 max-w-md text-lg leading-relaxed text-muted-foreground"
          >
            {t("landing.heroBody")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link
              to={user ? "/app" : "/auth"}
              className="group inline-flex items-center gap-2.5 rounded-full bg-lime px-7 py-3.5 text-sm font-medium text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--glow-lime)]"
            >
              {user ? t("landing.openWorkspace") : t("landing.startStudying")}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2.5 rounded-full border border-border px-7 py-3.5 text-sm text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-lime/40"
            >
              {t("landing.seeHow")}
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 1.5 }}
            className="mt-8 font-mono text-xs leading-relaxed text-muted-foreground"
          >
            {user ? t("landing.signedInReady") : t("landing.noSetup")}
            <br />
            {user ? t("landing.pickUp") : t("landing.bringMaterial")}
          </motion.p>
        </div>

        <div className="lg:col-span-6">
          <HeroInterface />
        </div>
      </div>
    </section>
  );
}
