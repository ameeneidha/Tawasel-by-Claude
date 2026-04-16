import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="py-32">
      <div className="container-tight text-center">
        <span className="text-brand-600 font-semibold text-sm uppercase tracking-wide">
          404
        </span>
        <h1 className="mt-2 text-5xl font-extrabold">Page not found</h1>
        <p className="mt-4 text-slate-600">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Link to="/" className="btn-primary mt-8">
          Back to home
        </Link>
      </div>
    </section>
  );
}
