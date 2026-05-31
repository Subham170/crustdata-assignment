import { getBandStyle } from '@/lib/format';

export default function ScoreBadge({ band, score, size = 'md', variant = 'light' }) {
  const style = getBandStyle(band);
  const sizeClasses =
    size === 'lg'
      ? 'px-4 py-2 text-sm'
      : 'px-3 py-1 text-xs';
  const scoreColor = variant === 'dark' ? 'text-white' : 'text-slate-900';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`inline-flex items-center gap-2 rounded-full font-semibold ring-1 ring-inset ${style.bg} ${style.text} ${style.ring} ${sizeClasses}`}
      >
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        {style.label}
      </span>
      {score != null && (
        <span className={`text-3xl font-bold tracking-tight ${scoreColor}`}>{score}</span>
      )}
    </div>
  );
}
