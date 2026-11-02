import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import {
  deleteCampaign,
  getNewsletterSettings,
  listCampaigns,
  listNewsletterSubscribers,
  saveCampaign,
  saveNewsletterSettings,
  sendCampaign,
  updateSubscriberStatus,
} from "@/admin/modules/newsletter/newsletter.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/lib/confirm-dialog";

export const Route = createFileRoute("/admin/newsletter/")({
  component: NewsletterPage,
});

function NewsletterPage() {
  const [tab, setTab] = useState("subscribers");
  const [subs, setSubs] = useState<Awaited<ReturnType<typeof listNewsletterSubscribers>>>([]);
  const [campaigns, setCampaigns] = useState<Awaited<ReturnType<typeof listCampaigns>>>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getNewsletterSettings>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState({ subject: "", html_body: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, st] = await Promise.all([
        listNewsletterSubscribers({ data: { q, status: "all" } }),
        listCampaigns(),
        getNewsletterSettings(),
      ]);
      setSubs(s);
      setCampaigns(c);
      setSettings(st);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load newsletter");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !settings) return <AdminSpinner label="Loading newsletter…" />;

  return (
    <div>
      <AdminPageHeader title="Newsletter" description="Subscribers, campaigns, and signup settings." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers" className="space-y-4">
          <div className="flex gap-2">
            <Input className="max-w-sm" placeholder="Search email…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="outline" onClick={() => void load()}>
              Search
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2">{s.source}</td>
                    <td className="px-3 py-2 capitalize">{s.status}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await updateSubscriberStatus({
                              data: {
                                id: s.id,
                                status: s.status === "subscribed" ? "unsubscribed" : "subscribed",
                              },
                            });
                            await load();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Update failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {s.status === "subscribed" ? "Unsubscribe" : "Resubscribe"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New campaign draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>HTML body</Label>
                <Textarea
                  rows={8}
                  value={draft.html_body}
                  onChange={(e) => setDraft((d) => ({ ...d, html_body: e.target.value }))}
                  placeholder="<p>Hello…</p>"
                />
              </div>
              <Button
                disabled={busy || !draft.subject}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveCampaign({ data: draft });
                    toast.success("Draft saved");
                    setDraft({ subject: "", html_body: "" });
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Save failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <ButtonSpinner /> : null}
                Save draft
              </Button>
              <p className="text-xs text-muted-foreground">
                Sending marks the campaign as sent to all subscribed emails. SMTP delivery can be wired via env later;
                for now send is recorded in the database.
              </p>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Recipients</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{c.subject}</td>
                    <td className="px-3 py-2 capitalize">{c.status}</td>
                    <td className="px-3 py-2">{c.recipient_count}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {c.status === "draft" ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const res = await sendCampaign({ data: { id: c.id } });
                                toast.success(
                                  res.simulated
                                    ? `Marked sent to ${res.recipient_count} subscribers (simulated SMTP)`
                                    : "Sent",
                                );
                                await load();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Send failed");
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Send
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: "Delete campaign?",
                              text: "This campaign will be permanently removed.",
                              confirmButtonText: "Delete",
                            });
                            if (!ok) return;
                            setBusy(true);
                            try {
                              await deleteCampaign({ data: { id: c.id } });
                              await load();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Delete failed");
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <Label>Signup enabled</Label>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
                />
              </div>
              <div className="space-y-1">
                <Label>From name</Label>
                <Input
                  value={settings.from_name}
                  onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Footer HTML</Label>
                <Textarea
                  rows={4}
                  value={settings.footer_html}
                  onChange={(e) => setSettings({ ...settings, footer_html: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Double opt-in</Label>
                <Switch
                  checked={settings.double_opt_in}
                  onCheckedChange={(v) => setSettings({ ...settings, double_opt_in: v })}
                />
              </div>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const saved = await saveNewsletterSettings({
                      data: {
                        enabled: settings.enabled,
                        from_name: settings.from_name,
                        footer_html: settings.footer_html,
                        double_opt_in: settings.double_opt_in,
                      },
                    });
                    setSettings(saved);
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
