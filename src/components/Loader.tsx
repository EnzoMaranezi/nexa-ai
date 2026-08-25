import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SITE } from "@/data/site";
import { useI18n } from "@/lib/i18n";

export function Loader({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 400 : 2600;
    const start = performance.now();
    let done = false;

    const interval = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / duration);
      setCount(Math.round(p * 100));
      if (p >= 1 && !done) {
        done = true;
        clearInterval(interval);
        setTimeout(() => {
          setVisible(false);
          onDone();
        }, 420);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [onDone]);

  const messages = [t("landing.loaderInit"), t("landing.loaderSystem"), t("landing.loaderReady")];
  const message = messages[count >= 100 ? 2 : count > 55 ? 1 : 0];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col justify-between bg-background px-6 py-10 md:px-12"
          exit={{ opacity: 0, filter: "blur(12px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden
        >
          <div className="flex items-start justify-between">
            <span className="label-mono">{t("landing.agent")}</span>
            <span className="label-mono">v1.0</span>
          </div>

          <div className="flex flex-col items-center gap-8">
            <motion.span
              className="text-[clamp(3rem,14vw,9rem)] font-medium leading-none tracking-[-0.05em]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              {SITE.name}
            </motion.span>
            <div className="w-full max-w-md">
              <div className="h-px w-full bg-surface-3">
                <div
                  className="h-px bg-lime transition-[width] duration-100 ease-linear"
                  style={{ width: `${count}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <span className="label-mono">{message}</span>
            <span className="font-mono text-4xl tabular-nums text-foreground md:text-6xl">
              {String(count).padStart(3, "0")}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
