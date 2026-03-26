import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="mt-2 text-slate-500">Page not found</p>
        <Link className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-white" to="/dashboard">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
