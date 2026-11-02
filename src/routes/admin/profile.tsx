import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getOwnAdminProfile, updateOwnAdminProfile } from "@/admin/auth/auth.functions";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/profile")({
  component: AdminProfilePage,
});

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{
    role: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const profile = await getOwnAdminProfile();
        setForm({
          name: profile.name,
          email: profile.email,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setMeta({
          role: profile.role,
          is_active: profile.is_active,
          last_login_at: profile.last_login_at,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <AdminSpinner />;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Profile"
        description="View and update your admin account details."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {meta ? (
            <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium capitalize">{meta.role}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{meta.is_active ? "Active" : "Inactive"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last login</dt>
                <dd className="font-medium">{fmtDate(meta.last_login_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">{fmtDate(meta.created_at)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="font-medium">{fmtDate(meta.updated_at)}</dd>
              </div>
            </dl>
          ) : null}

          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            <p className="text-xs text-muted-foreground">Must be unique across admin accounts.</p>
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Change password (optional)</p>
            <div className="grid gap-3 sm:grid-cols-1">
              <div className="space-y-1">
                <Label>Current password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>New password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1">
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <Button
            disabled={busy || !form.name.trim() || !form.email.trim()}
            onClick={async () => {
              if (form.newPassword || form.confirmPassword || form.currentPassword) {
                if (form.newPassword.length < 8) {
                  toast.error("New password must be at least 8 characters");
                  return;
                }
                if (form.newPassword !== form.confirmPassword) {
                  toast.error("New password and confirmation do not match");
                  return;
                }
                if (!form.currentPassword) {
                  toast.error("Enter your current password to change it");
                  return;
                }
              }
              setBusy(true);
              try {
                const saved = await updateOwnAdminProfile({
                  data: {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    ...(form.newPassword
                      ? {
                          currentPassword: form.currentPassword,
                          newPassword: form.newPassword,
                        }
                      : {}),
                  },
                });
                setForm({
                  name: saved.name,
                  email: saved.email,
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
                setMeta({
                  role: saved.role,
                  is_active: saved.is_active,
                  last_login_at: saved.last_login_at,
                  created_at: saved.created_at,
                  updated_at: saved.updated_at,
                });
                toast.success("Profile updated");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Update failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <ButtonSpinner /> : null}
            Save profile
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
