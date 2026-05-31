import Link from 'next/link';

export default function AppHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            GL
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">GrowthLens AI</p>
            <p className="text-xs text-slate-500">Employer growth intelligence</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium text-slate-600">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Upload
          </Link>
          <Link
            href="/compare"
            className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Compare
          </Link>
        </nav>
      </div>
    </header>
  );
}
