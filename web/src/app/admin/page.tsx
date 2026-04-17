"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended: boolean;
  createdAt: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);

  async function refresh() {
    const r = await fetch("/api/admin/users", { credentials: "include" });
    if (!r.ok) return;
    const data = (await r.json()) as { users: UserRow[] };
    setUsers(data.users);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggle(u: UserRow) {
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suspended: !u.suspended }),
    });
    if (!r.ok) alert(await r.text());
    void refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Suspend or restore access for any account except your own.</p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--foreground)]">{u.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{u.email}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{u.role}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      u.suspended ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-100" : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                    }`}
                  >
                    {u.suspended ? "Suspended" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void toggle(u)}
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--muted-bg)]"
                  >
                    {u.suspended ? "Restore" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
