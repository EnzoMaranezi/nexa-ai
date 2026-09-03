import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-1 w-1 rounded-full bg-lime animate-pulse-dot" aria-hidden />
      <span className="label-mono">{children}</span>
    </div>
  );
}

export function CTAButton({
  children,
  href = "#beta",
  variant = "primary",
  className,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "ghost";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-medium transition-all duration-300",
        variant === "primary"
          ? "bg-lime text-background hover:shadow-[var(--glow-lime)] hover:-translate-y-0.5"
          : "border border-border text-foreground hover:border-lime/50 hover:bg-surface-2 hover:-translate-y-0.5",
        className,
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface/70 backdrop-blur-xl transition-all duration-500",
        "hover:-translate-y-1 hover:border-lime/25",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Bar({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
      <motion.div
        className={cn("h-full rounded-full", muted ? "bg-muted-foreground/50" : "bg-lime")}
        initial={{ width: 0 }}
        whileInView={{ width: `${value}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
