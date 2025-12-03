"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FiBell } from "react-icons/fi";

type User = {
  id: number;
  email: string;
  role: string;
  created_at: string;
  tasks_count?: number;
  notes_count?: number;
};

export default function AdminDashboardPanel() {
  const router = useRouter();

  // -------------------------
  // STATE
  // -------------------------
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);

  const [active, setActive] = useState("dashboard");
  const [dark, setDark] = useState(false);

  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotif, setShowNotif] = useState(false);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // -------------------------
  // COMPUTED VALUES
  // -------------------------
  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === "admin").length;
    const totalUsers = users.length;
    const tasksTotal = users.reduce((s, u) => s + (u.tasks_count ?? 0), 0);
    const notesTotal = users.reduce((s, u) => s + (u.notes_count ?? 0), 0);
    return { admins, totalUsers, tasksTotal, notesTotal };
  }, [users]);

  const filteredUsers = useMemo(() => {
    let list = [...users];
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, roleFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / perPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredUsers.slice(start, start + perPage);
  }, [filteredUsers, page, perPage]);

  // -------------------------
  // EFFECTS
  // -------------------------
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (!role) router.replace("/");
    else if (role !== "admin") router.replace("/dashboard");
    else fetchUsers();
  }, []);

  // -------------------------
  // FETCH USERS
  // -------------------------
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/users");
      const data = await res.json();

      const withCounts = await Promise.all(
        data.map(async (u: User) => {
          try {
            const [tasksRes, notesRes] = await Promise.all([
              fetch(`http://localhost:5000/todos/${u.id}`),
              fetch(`http://localhost:5000/notes/${u.id}`),
            ]);
            const tasks = await tasksRes.json();
            const notes = await notesRes.json();
            return {
              ...u,
              tasks_count: Array.isArray(tasks) ? tasks.length : 0,
              notes_count: Array.isArray(notes) ? notes.length : 0,
            };
          } catch {
            return { ...u, tasks_count: 0, notes_count: 0 };
          }
        })
      );

      setUsers(withCounts);
    } catch (err) {
      console.error("fetchUsers error:", err);
      setMessage("Failed to fetch users.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // HANDLERS
  // -------------------------
  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!newAdminEmail || !newAdminPassword) {
      setMessage("Provide email & password.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newAdminEmail,
          password: newAdminPassword,
          role: "admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add admin");

      setMessage("Admin added.");
      setNewAdminEmail("");
      setNewAdminPassword("");
      await fetchUsers();
      setActive("users");
      setPage(1);

      setNotifications((prev) => [...prev, `New admin added: ${newAdminEmail}`]);
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Error adding admin.");
    }
  };

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // -------------------------
  // COMPONENTS
  // -------------------------
  const NavItem = ({ id, label }: { id: string; label: string }) => (
    <button
      onClick={() => {
        setActive(id);
        if (id === "add-admin") setPage(1);
      }}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition ${
        active === id
          ? "bg-indigo-600 text-white shadow-md"
          : "text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-800/40"
      }`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          active === id ? "bg-white" : "bg-indigo-300"
        }`}
      />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  const StatsCard = ({
    label,
    value,
    colorClass,
    description,
  }: {
    label: string;
    value: number;
    colorClass: string;
    description: string;
  }) => (
    <div className="bg-white dark:bg-gray-800/60 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{description}</div>
    </div>
  );

  const NotificationsDropdown = () => (
    <div className="relative">
      <div
        className="cursor-pointer text-gray-600 dark:text-gray-200"
        onClick={() => setShowNotif(!showNotif)}
      >
        <FiBell size={24} />
      </div>
      {notifications.length > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 text-xs bg-red-500 text-white rounded-full flex items-center justify-center">
          {notifications.length}
        </span>
      )}
      {showNotif && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {notifications.length === 0 ? (
            <div className="p-3 text-gray-500 dark:text-gray-300 text-sm">
              No notifications
            </div>
          ) : (
            notifications.map((note, i) => (
              <div
                key={i}
                className="p-3 border-b border-gray-100 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200"
              >
                {note}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  // -------------------------
  // LOGOUT MODAL
  // -------------------------
  const LogoutModal = () => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-96 shadow-lg">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          Confirm Logout
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Are you sure you want to log out?
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setShowLogoutModal(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              localStorage.removeItem("role");
              router.replace("/");
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );

  // -------------------------
  // RENDER
  // -------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-200 via-violet-300 to-violet-400 dark:bg-gradient-to-br dark:from-gray-800 dark:via-gray-900 dark:to-black text-gray-800 dark:text-gray-100 transition-colors">
      <div className="max-w-[1200px] mx-auto p-6 md:p-8 grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur rounded-2xl p-4 flex flex-col gap-4 shadow">
          <div className="px-2 py-3">
            <h2 className="text-lg font-bold text-indigo-700">Admin Panel</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Manage users</p>
          </div>
          <nav className="flex flex-col gap-2 px-1">
            <NavItem id="dashboard" label="Dashboard" />
            <NavItem id="add-admin" label="Add Admin" />
            <NavItem id="users" label="Users List" />
            <NavItem id="tasks" label="Tasks" />
            <NavItem id="notes" label="Notes" />
            <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-3" />
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-200" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </nav>
        </aside>

        {/* Main */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10 space-y-6">
          {/* Top - Stats + Search */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                label="Admins"
                value={stats.admins}
                colorClass="text-indigo-700"
                description="Total admin accounts"
              />
              <StatsCard
                label="Users"
                value={stats.totalUsers}
                colorClass=""
                description="All registered users"
              />
              <StatsCard
                label="Tasks"
                value={stats.tasksTotal}
                colorClass=""
                description="Total tasks assigned"
              />
              <StatsCard
                label="Notes"
                value={stats.notesTotal}
                colorClass=""
                description="Total notes"
              />
            </div>

            <div className="w-full md:w-auto bg-white dark:bg-gray-800/60 p-3 rounded-2xl flex gap-3 items-center border border-gray-100 dark:border-gray-700">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by email or role..."
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:bg-transparent"
              />
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as any);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-transparent"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-transparent"
              >
                <option value={5}>5</option>
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={20}>20</option>
              </select>

              <NotificationsDropdown />
            </div>
          </div>

          {/* Add Admin */}
          {active === "add-admin" && (
            <section className="bg-white dark:bg-gray-800/60 rounded-2xl p-6 shadow border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-semibold mb-3">Register New Admin</h3>
              {message && (
                <div className="mb-3 text-sm text-green-700 bg-green-100 px-3 py-2 rounded">
                  {message}
                </div>
              )}
              <form
                onSubmit={handleAddAdmin}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  required
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  required
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg shadow">
                    Add Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAdminEmail("");
                      setNewAdminPassword("");
                      setMessage("");
                    }}
                    className="px-4 py-2 border rounded-lg"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Users List */}
          {(active === "users" || active === "dashboard") && (
            <section className="bg-white dark:bg-gray-800/60 rounded-2xl p-4 shadow border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {active === "dashboard" ? "Overview — Users" : "Users List"}
                </h3>
                <div className="text-sm text-gray-500">
                  Showing {filteredUsers.length} result(s)
                </div>
              </div>
              {loading ? (
                <div className="py-8 text-center text-gray-600">
                  Loading users...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className="text-left text-sm uppercase text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3 text-center">Tasks</th>
                        <th className="px-4 py-3 text-center">Notes</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((u) => (
                        <tr
                          key={u.id}
                          className="border-t border-gray-100 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        >
                          <td className="px-4 py-4">{u.email}</td>
                          <td className="px-4 py-4 capitalize font-medium text-indigo-700">
                            {u.role}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm">
                              {u.tasks_count ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                              {u.notes_count ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded border"
                        disabled={page === 1}
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1 rounded border"
                        disabled={page === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && <LogoutModal />}
    </div>
  );
}