import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AppCard({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur-xl md:p-7",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function AppLabel({ children }: { children: ReactNode }) {
  return <p className="label-mono">{children}</p>;
}

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <AppCard>
      <AppLabel>{label}</AppLabel>
      <p className="mt-4 font-mono text-4xl tracking-tight">{value}%</p>
      <ProgressBar value={value} className="mt-5" label={label} />
    </AppCard>
  );
}

export function ProgressBar({
  value,
  className,
  muted = false,
  label,
}: {
  value: number;
  className?: string;
  muted?: boolean;
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? t("common.progress")}
    >
      <motion.div
        className={cn("h-full rounded-full", muted ? "bg-muted-foreground/50" : "bg-lime")}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-medium text-background transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-[var(--glow-lime)]",
        "disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm text-foreground transition-all duration-300 hover:border-lime/40 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  children,
  variant = "primary",
  className,
}: {
  to: NonNullable<LinkProps["to"]>;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5",
        variant === "primary"
          ? "bg-lime text-background hover:shadow-[var(--glow-lime)]"
          : "border border-border text-foreground hover:border-lime/40 hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: NonNullable<LinkProps["to"]>;
}) {
  return (
    <AppCard className="flex flex-col items-center gap-4 border-dashed py-14 text-center">
      <AppLabel>{title}</AppLabel>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
        {body}
      </p>
      {actionLabel && actionTo && (
        <LinkButton to={actionTo} className="mt-2">
          {actionLabel} <span aria-hidden>→</span>
        </LinkButton>
      )}
    </AppCard>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-3 w-full animate-pulse rounded-full bg-surface-3",
        className,
      )}
      aria-hidden
    />
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();

  return (
    <AppCard className="border-destructive/30">
      <AppLabel>{t("common.error")}</AppLabel>
      <p className="mt-3 text-lg">{title ?? t("common.somethingWrong")}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {onRetry && (
        <GhostButton className="mt-6" onClick={onRetry}>
          {t("common.retry")} <span aria-hidden>→</span>
        </GhostButton>
      )}
    </AppCard>
  );
}
