import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  FileStack,
  GraduationCap,
  LineChart,
  Settings,
  Menu,
  X,
  User,
  Plus,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/authService";
import { SITE } from "@/data/site";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const NAV = [
  { labelKey: "nav.overview", shortKey: "nav.overview", to: "/app", icon: LayoutDashboard, exact: true },
  { labelKey: "nav.materials", shortKey: "nav.materials", to: "/app/materials", icon: FileStack, exact: false },
  { labelKey: "nav.studySessions", shortKey: "nav.studySessions", to: "/app/sessions", icon: GraduationCap, exact: false },
  { labelKey: "nav.progress", shortKey: "nav.progress", to: "/app/results", icon: LineChart, exact: false },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useI18n();

  return (
    <nav className="flex flex-col gap-1" aria-label={t("nav.workspaceAria")}>
      <p className="label-mono px-3 pb-3">{t("nav.workspace")}</p>
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-lime")} aria-hidden />
            {t(item.labelKey)}
          </Link>
        );
      })}

      <div className="my-4 h-px bg-border" />

      <Link
        to="/app/material"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-lime/40 hover:text-foreground"
      >
        <Plus className="h-4 w-4" aria-hidden />
        {t("common.addMaterial")}
      </Link>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useI18n();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-5 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-border p-2 lg:hidden"
              aria-label={open ? t("nav.closeNavigation") : t("nav.openNavigation")}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Link to="/" className="font-mono text-sm tracking-[0.2em]">
              {SITE.name}
            </Link>
            <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
              / {t("nav.workspace")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-border bg-surface/60 py-2 pl-3 pr-4 sm:flex">
              <User className="h-3.5 w-3.5 text-lime" aria-hidden />
              <span className="max-w-[10rem] truncate font-mono text-[11px] text-muted-foreground">
                {user?.email ?? t("nav.signedIn")}
              </span>
            </span>
            <button
              type="button"
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
              onClick={() => void handleSignOut()}
              className="rounded-full border border-border p-2.5 transition-colors hover:border-lime/40"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col justify-between border-r border-border p-5 lg:flex">
          <NavList />
          <Link
            to="/app/settings"
            aria-current={pathname === "/app/settings" ? "page" : undefined}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2/60 hover:text-foreground"
          >
            <Settings className={cn("h-4 w-4", pathname === "/app/settings" && "text-lime")} aria-hidden />
            {t("common.settings")}
          </Link>
        </aside>

        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                type="button"
                aria-label={t("nav.closeNavigation")}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative h-full w-72 border-r border-border bg-surface p-5"
              >
                <NavList onNavigate={() => setOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 px-5 pb-24 pt-8 md:px-8 md:pb-16 md:pt-10">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
        aria-label={t("nav.primaryNavigation")}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "text-lime" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px]"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(item.shortKey).split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
