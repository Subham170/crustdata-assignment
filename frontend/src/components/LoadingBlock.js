export default function LoadingBlock({ title, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-8 py-16 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      </div>
    </div>
  );
}
