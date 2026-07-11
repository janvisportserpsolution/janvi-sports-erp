import { useMemo, useState } from "react";
import { useAuth, useData } from "../store";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS } from "../rbac";
import type { PermissionKey, RoleName } from "../types";
import { Database, Trash2, AlertTriangle, Building2, ShieldCheck, UserPlus, Trash2 as TrashIcon, KeyRound } from "lucide-react";

export default function Settings() {
  const products = useData((s) => s.products);
  const customers = useData((s) => s.customers);
  const invoices = useData((s) => s.invoices);
  const returns = useData((s) => s.salesReturns);
  const resetAll = useData((s) => s.resetAll);
  const users = useData((s) => s.users);
  const createUser = useData((s) => s.createUser);
  const updateUser = useData((s) => s.updateUser);
  const deleteUser = useData((s) => s.deleteUser);
  const setUserPermissions = useData((s) => s.setUserPermissions);
  const currentUser = useAuth((s) => s.user);
  const [message, setMessage] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "tour_user" as RoleName });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<RoleName>("tour_user");
  const [editingPermissions, setEditingPermissions] = useState<PermissionKey[]>([]);

  const roleOptions = useMemo(() => Object.entries(ROLE_DEFINITIONS), []);

  const confirmReset = () => {
    if (window.confirm("Reset ALL data? This will erase all invoices, customers and stock changes. Continue?")) {
      resetAll();
      window.alert("Data has been reset to demo state.");
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim()) {
      setMessage("Name is required");
      return;
    }
    if (!newUser.email.trim()) {
      setMessage("Email is required");
      return;
    }
    if (!newUser.password.trim()) {
      setMessage("Password is required");
      return;
    }
    const result = createUser({
      name: newUser.name.trim(),
      email: newUser.email.trim().toLowerCase(),
      mobile: "",
      password_hash: newUser.password,
      role: newUser.role,
      permissions: [],
      is_active: true,
    });
    setMessage(result.message);
    if (result.ok) {
      setNewUser({ name: "", email: "", password: "", role: "tour_user" });
    }
  };

  const handleEditUser = (userId: string) => {
    const user = users.find((entry) => entry.id === userId);
    if (!user) return;
    setEditingUserId(userId);
    setEditingRole(user.role as RoleName);
    setEditingPermissions(user.permissions ?? []);
  };

  const handleSaveUser = (userId: string) => {
    const result = updateUser(userId, { role: editingRole, permissions: editingPermissions });
    setMessage(result.message);
    if (result.ok) setEditingUserId(null);
  };

  const handleDeleteUser = (userId: string) => {
    if (!window.confirm("Delete this user?")) return;
    const result = deleteUser(userId);
    setMessage(result.message);
  };

  const togglePermission = (permission: PermissionKey, target: PermissionKey[]) => {
    return target.includes(permission) ? target.filter((item) => item !== permission) : [...target, permission];
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-6 text-white shadow-xl sm:p-8">
        <div className="bg-mesh absolute inset-0 opacity-60" />
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Database size={12} /> System Configuration
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Settings</h1>
          <p className="mt-1 text-sm text-white/80">Manage your ERP configuration and data</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <Building2 size={20} />
          </div>
          <div>
            <div className="font-semibold text-slate-900">JANVI SPORTS</div>
            <div className="text-xs text-slate-500">ERP System · V1</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Products" value={products.length} />
          <Stat label="Customers" value={customers.length} />
          <Stat label="Invoices" value={invoices.length} />
          <Stat label="Returns" value={returns.length} />
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Role-Based Access Control</h3>
            <p className="text-sm text-slate-600">Create users, assign roles, and manage permission scopes for your ERP teams.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <UserPlus size={16} className="text-orange-500" /> Create a new user
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <input
                value={newUser.name}
                onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@company.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Temporary password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value as RoleName }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {roleOptions.map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                <UserPlus size={15} /> Add user
              </button>
            </form>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-800">Existing users</div>
            {users.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{entry.name}</div>
                    <div className="text-sm text-slate-500">{entry.email || entry.mobile}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-orange-600">{entry.role}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditUser(entry.id)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">Edit</button>
                    {entry.role !== "admin" && (
                      <button onClick={() => handleDeleteUser(entry.id)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700">
                        <TrashIcon size={13} className="inline" />
                      </button>
                    )}
                  </div>
                </div>

                {editingUserId === entry.id ? (
                  <div className="mt-3 space-y-3">
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value as RoleName)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {roleOptions.map(([key, role]) => (
                        <option key={key} value={key}>{role.label}</option>
                      ))}
                    </select>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ALL_PERMISSIONS.map((permission) => (
                        <label key={permission} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={editingPermissions.includes(permission)}
                            onChange={() => setEditingPermissions((prev) => togglePermission(permission, prev))}
                          />
                          {permission}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveUser(entry.id)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Save</button>
                      <button onClick={() => setEditingUserId(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
                      <KeyRound size={13} /> Permissions
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(entry.permissions?.length ? entry.permissions : ROLE_DEFINITIONS[entry.role as keyof typeof ROLE_DEFINITIONS]?.permissions ?? []).slice(0, 6).map((permission) => (
                        <span key={permission} className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">{permission}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Reset Demo Data</h3>
            <p className="mt-1 text-sm text-slate-600">
              This will erase all invoices, sales returns, customer ledgers and stock transactions, then restore the demo seed data.
            </p>
            <button
              onClick={confirmReset}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              <Trash2 size={14} /> Reset All Data
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Database size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">System Architecture</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>• <strong>Pattern:</strong> Modular Monolith with REST APIs</li>
              <li>• <strong>Frontend:</strong> React + TypeScript + TailwindCSS</li>
              <li>• <strong>State:</strong> Zustand (client) + persistent storage</li>
              <li>• <strong>Transactions:</strong> Atomic operations on invoices & returns</li>
              <li>• <strong>Inventory:</strong> Row-level validation with availability check</li>
              <li>• <strong>Ledger:</strong> Automatic balance tracking per customer</li>
              <li>• <strong>Authentication:</strong> Persistent session + secured routes</li>
              <li>• <strong>PDF:</strong> jsPDF for invoice generation</li>
              <li>• <strong>QR:</strong> html5-qrcode for camera scanning</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
