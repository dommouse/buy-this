import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import {
  createPortalUser,
  deletePortalUser,
  listPortalUsers,
  updatePortalUser,
} from "@/admin/modules/users/users.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/lib/confirm-dialog";

export const Route = createFileRoute("/admin/users/")({
  component: UsersPage,
});

type UserRow = Awaited<ReturnType<typeof listPortalUsers>>[number];

function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listPortalUsers({ data: { q, active: "all" } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      if (editing) {
        await updatePortalUser({
          data: {
            id: editing.id,
            name: form.name,
            ...(form.password ? { password: form.password } : {}),
          },
        });
        toast.success("User updated");
      } else {
        await createPortalUser({ data: form });
        toast.success("User created");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Portal members registered from the public site."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ name: "", email: "", password: "" });
              setOpen(true);
            }}
          >
            Add user
          </Button>
        }
      />
      <div className="mb-4 flex gap-2">
        <Input className="max-w-sm" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={() => void load()}>
          Search
        </Button>
      </div>
      {loading ? (
        <AdminSpinner />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={row.is_active}
                      disabled={busy}
                      onCheckedChange={async () => {
                        setBusy(true);
                        try {
                          await updatePortalUser({ data: { id: row.id, is_active: !row.is_active } });
                          await load();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Update failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(row);
                          setForm({ name: row.name, email: row.email, password: "" });
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Delete this user?",
                            text: `Remove ${row.email} from the portal?`,
                            confirmButtonText: "Delete",
                          });
                          if (!ok) return;
                          setBusy(true);
                          try {
                            await deletePortalUser({ data: { id: row.id } });
                            toast.success("Deleted");
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
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No users yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            {!editing ? (
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>{editing ? "New password (optional)" : "Password"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <ButtonSpinner /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
