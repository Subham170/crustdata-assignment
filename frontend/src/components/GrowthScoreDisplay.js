import { getBandStyle } from '@/lib/format';

/**
 * Clear growth exposure score for tables and lists.
 * @param {{ score: number, band: string, size?: 'sm' | 'md' }} props
 */
export default function GrowthScoreDisplay({ score, band, size = 'sm' }) {
  const style = getBandStyle(band);
  const pct = Math.min(100, Math.max(0, Math.round(score ?? 0)));
  const isCompact = size === 'sm';

  return (
    <div className={isCompact ? 'w-[8.5rem]' : 'w-full max-w-xs'}>
      <div className="flex items-baseline gap-0.5">
        <span
          className={`font-bold tabular-nums text-slate-900 ${isCompact ? 'text-base' : 'text-3xl'}`}
        >
          {pct}
        </span>
        <span className={`font-medium text-slate-400 ${isCompact ? 'text-xs' : 'text-sm'}`}>
          /100
        </span>
      </div>

      <div
        className={`overflow-hidden rounded-full bg-slate-100 ${isCompact ? 'mt-1.5 h-1.5' : 'mt-2 h-2'}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Growth exposure score ${pct} out of 100`}
      >
        <div
          className={`h-full rounded-full transition-all ${style.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className={`mt-1 font-medium leading-tight ${style.text} ${isCompact ? 'text-[11px]' : 'text-sm'}`}>
        {style.exposureLabel}
      </p>
    </div>
  );
}
