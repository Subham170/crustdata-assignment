import GrowthScoreDisplay from './GrowthScoreDisplay';

const STATUS_STYLES = {
  uploaded: 'bg-slate-100 text-slate-700',
  parsing: 'bg-sky-50 text-sky-800',
  analyzing: 'bg-amber-50 text-amber-800',
  completed: 'bg-emerald-50 text-emerald-800',
  failed: 'bg-red-50 text-red-800',
};

export default function CandidateProfile({ candidate }) {
  const status = candidate.status?.toLowerCase() || 'uploaded';
  const report = candidate.report;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {candidate.name || 'Unnamed candidate'}
          </h1>
          {candidate.email && (
            <p className="mt-1 text-sm text-slate-500">{candidate.email}</p>
          )}
          <p className="mt-2 font-mono text-xs text-slate-400">{candidate.id}</p>
          <span
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status] || STATUS_STYLES.uploaded}`}
          >
            {status}
          </span>
        </div>

        {report && (
          <GrowthScoreDisplay
            score={report.growthScore}
            band={report.scoreBand}
            size="md"
          />
        )}
      </div>
    </section>
  );
}
