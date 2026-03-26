import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ThemeToggle } from '../components/ThemeToggle';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export function AppLayout() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="saas-bg min-h-screen p-3 sm:p-4">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">
          <Sidebar role={user?.role} />
        </div>

        {menuOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="h-full w-72 p-3" onClick={(e) => e.stopPropagation()}>
              <Sidebar onNavigate={() => setMenuOpen(false)} role={user?.role} />
            </div>
          </div>
        ) : null}

        <main className="space-y-4 enter-fade">
          <header className="glass-panel flex flex-col gap-3 rounded-2xl p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="rounded-xl border border-slate-300 bg-white/70 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70"
                >
                  Menu
                </button>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">User Engagement Tracker</p>
              </div>
              <p className="hidden text-xs uppercase tracking-[0.18em] text-slate-400 lg:block">User Engagement Tracker</p>
              <p className="text-lg font-semibold">Welcome back, {user?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <button
                type="button"
                onClick={logout}
                className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              >
                Logout
              </button>
            </div>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
