import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

     if (!isValidEmail(form.email.trim())) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.login({
        email: form.email.trim(),
        password: form.password
      });
      setSession(res);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authService.login({ email: 'admin@example.com', password: 'password123' });
      setSession(res);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Access analytics dashboard</p>
        <p className="mt-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-200">
          Demo admin: `admin@example.com` / `password123`
        </p>

        <div className="mt-5 space-y-3">
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
        </div>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-brand-600 px-3 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>

        <button
          type="button"
          onClick={demoLogin}
          disabled={loading}
          className="mt-2 w-full rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-brand-700 transition hover:bg-brand-100 disabled:opacity-60 dark:border-brand-700/60 dark:bg-brand-950/40 dark:text-brand-200"
        >
          Quick Demo Login
        </button>

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          No account? <Link className="text-brand-600" to="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
