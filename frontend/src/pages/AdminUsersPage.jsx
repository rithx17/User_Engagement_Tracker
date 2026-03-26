import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { analyticsService } from '../services/analyticsService';
import { Loader } from '../components/Loader';

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService
      .listUsers()
      .then((res) => setUsers(res.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await analyticsService.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'engagement-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <Loader label="Loading users..." />;
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel enter-up flex flex-col gap-3 rounded-2xl p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Admin Panel</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage users and export engagement reports</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}

      <div className="glass-panel enter-up overflow-x-auto rounded-2xl p-5 shadow-soft">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Created</th>
              <th className="px-2 py-2">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.length ? (
              users.map((user) => (
                <tr key={user._id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-2">{user.name}</td>
                  <td className="px-2 py-2">{user.email}</td>
                  <td className="px-2 py-2">{user.role}</td>
                  <td className="px-2 py-2">{new Date(user.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-2">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-2 py-4 text-slate-500" colSpan={5}>No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
