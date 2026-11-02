import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getSiteSettings, saveSiteSettings } from "@/admin/modules/settings/settings.functions";
import type { SettingsMap } from "@/admin/lib/settings.server";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [form, setForm] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setForm(await getSiteSettings());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !form) return <AdminSpinner />;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Settings"
        description="Site-wide options. Manage your account on the Profile page."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Site</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>App name</Label>
            <Input
              value={String(form["appName"] ?? "")}
              onChange={(e) => setForm({ ...form, appName: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Support email</Label>
            <Input
              value={String(form["supportEmail"] ?? "")}
              onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Show blogs on home</Label>
            <Switch
              checked={Boolean(form["showBlogsOnHome"])}
              onCheckedChange={(v) => setForm({ ...form, showBlogsOnHome: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Show membership teaser</Label>
            <Switch
              checked={Boolean(form["showMembershipTeaser"])}
              onCheckedChange={(v) => setForm({ ...form, showMembershipTeaser: v })}
            />
          </div>
          <div className="space-y-1">
            <Label>Default admin page size</Label>
            <Input
              type="number"
              value={Number(form["defaultPageSize"] ?? 20)}
              onChange={(e) => setForm({ ...form, defaultPageSize: Number(e.target.value) || 20 })}
            />
          </div>
          <div className="space-y-1">
            <Label>Instagram URL</Label>
            <Input
              value={String(form["socialInstagram"] ?? "")}
              onChange={(e) => setForm({ ...form, socialInstagram: e.target.value })}
              placeholder="https://instagram.com/…"
            />
          </div>
          <div className="space-y-1">
            <Label>X / Twitter URL</Label>
            <Input
              value={String(form["socialTwitter"] ?? "")}
              onChange={(e) => setForm({ ...form, socialTwitter: e.target.value })}
              placeholder="https://x.com/…"
            />
          </div>
          <div className="space-y-1">
            <Label>Facebook URL</Label>
            <Input
              value={String(form["socialFacebook"] ?? "")}
              onChange={(e) => setForm({ ...form, socialFacebook: e.target.value })}
              placeholder="https://facebook.com/…"
            />
          </div>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const saved = await saveSiteSettings({ data: form });
                setForm(saved);
                window.dispatchEvent(new Event("site-settings-updated"));
                toast.success("Settings saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <ButtonSpinner /> : null}
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Name, email, and password are managed on your Profile page.</p>
          <Button asChild variant="outline">
            <Link to="/admin/profile">Open Profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
