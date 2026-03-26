import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Analytics' },
  { to: '/admin/users', label: 'Users', adminOnly: true }
];

export function Sidebar({ onNavigate, role }) {
  const { pathname } = useLocation();
  const visibleLinks = links.filter((link) => !link.adminOnly || role === 'admin');

  return (
    <aside className="glass-panel w-full rounded-2xl p-4 shadow-soft lg:w-64">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
        Engagement Hub
      </p>
      <nav className="space-y-2">
        {visibleLinks.map((link) => {
          const active = pathname.startsWith(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              className={`block rounded-xl px-3 py-2 text-sm transition ${
                active
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                  : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/70'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
