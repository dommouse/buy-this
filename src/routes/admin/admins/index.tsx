import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { createAdmin, deleteAdmin, listAdmins, updateAdmin } from "@/admin/modules/admins/admins.functions";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/lib/confirm-dialog";

export const Route = createFileRoute("/admin/admins/")({
  component: AdminsPage,
});

type AdminRow = Awaited<ReturnType<typeof listAdmins>>[number];

function AdminsPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" as "admin" | "super" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdmins({ data: { q, active: "all" } });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", password: "", role: "admin" });
    setOpen(true);
  }

  function openEdit(row: AdminRow) {
    setEditing(row);
    setForm({ name: row.name, email: row.email, password: "", role: row.role });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      if (editing) {
        await updateAdmin({
          data: {
            id: editing.id,
            name: form.name,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          },
        });
        toast.success("Admin updated");
      } else {
        await createAdmin({
          data: {
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
          },
        });
        toast.success("Admin created");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: AdminRow) {
    setBusy(true);
    try {
      await updateAdmin({ data: { id: row.id, is_active: !row.is_active } });
      toast.success(row.is_active ? "Deactivated" : "Activated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: AdminRow) {
    const ok = await confirmDialog({
      title: "Delete this admin?",
      text: `Remove ${row.email} and revoke their access?`,
      confirmButtonText: "Delete",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteAdmin({ data: { id: row.id } });
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Admins"
        description="Manage admin users who can access this portal."
        actions={
          <Button onClick={openCreate} disabled={busy}>
            Add admin
          </Button>
        }
      />
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
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
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2 capitalize">{row.role}</td>
                  <td className="px-3 py-2">
                    <Switch checked={row.is_active} onCheckedChange={() => void toggleActive(row)} disabled={busy} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.last_login_at ? new Date(row.last_login_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void remove(row)} disabled={busy}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No admins found
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
            <DialogTitle>{editing ? "Edit admin" : "Add admin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            {!editing ? (
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
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
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "admin" | "super" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super">Super</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy || !form.name || (!editing && (!form.email || !form.password))}>
              {busy ? <ButtonSpinner /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
