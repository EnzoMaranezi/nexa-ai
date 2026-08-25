import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

/** Short cinematic handoff from the landing page into the product. */
export function WorkspaceTransition({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      onClose();
      navigate({ to: "/app" });
    }, 1400);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open, navigate, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-6 bg-background px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          aria-live="polite"
        >
          <p className="label-mono">{t("landing.enteringWorkspace")}</p>
          <div className="h-px w-64 overflow-hidden bg-surface-3">
            <motion.div
              className="h-px bg-lime"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.3, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
