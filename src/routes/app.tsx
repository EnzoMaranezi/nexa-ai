import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { isPasswordRecoveryPending } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (isPasswordRecoveryPending()) {
      throw redirect({ to: "/auth/reset" });
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },

  head: () => ({
    meta: [
      { title: "NEXA Workspace — Your academic agent" },
      {
        name: "description",
        content:
          "Your NEXA academic workspace: materials, AI-generated study plans, active recall sessions and learning progress.",
      },
      { property: "og:title", content: "NEXA Workspace" },
      { property: "og:description", content: "Materials, study plans, sessions and progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
