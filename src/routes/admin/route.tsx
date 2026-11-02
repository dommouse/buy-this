import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { getAdminSession } from "@/admin/auth/auth.functions";
import { AdminShell } from "@/admin/layout/admin-shell";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") return { admin: null };
    const admin = await getAdminSession();
    if (!admin) {
      throw redirect({
        to: "/admin/login",
        search: { redirect: location.href },
      });
    }
    return { admin };
  },
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  const { admin } = Route.useRouteContext();
  // Login page renders without shell
  if (!admin) return <Outlet />;
  return (
    <>
      <AdminShell admin={admin}>
        <Outlet />
      </AdminShell>
      <Toaster richColors position="top-right" />
    </>
  );
}
