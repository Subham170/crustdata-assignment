import ScoreBadge from './ScoreBadge';
import { formatPercent, formatDate } from '@/lib/format';

export default function AnalysisResults({ data }) {
  const employers = data.employers || data.report?.employerScores || [];
  const signals = data.signals || data.report?.signals;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-300">
          Growth Exposure Score
        </p>
        <div className="mt-4">
          <ScoreBadge band={data.scoreBand} score={data.growthScore} size="lg" variant="dark" />
        </div>
        {data.summary && (
          <p className="mt-6 text-sm leading-relaxed text-slate-200">{data.summary}</p>
        )}
      </section>

      {signals && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Hiring signals
          </h3>
          <p className="mt-3 text-sm text-slate-700">{signals.growthExposureSummary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SignalPill label="Startup readiness" value={signals.startupReadiness} />
            <SignalPill label="Enterprise readiness" value={signals.enterpriseReadiness} />
            <SignalPill label="Scaling experience" value={signals.scalingExperience} />
          </div>
          {signals.hiringSignals?.length > 0 && (
            <ul className="mt-4 space-y-2">
              {signals.hiringSignals.map((signal) => (
                <li
                  key={signal}
                  className="flex gap-2 text-sm text-slate-600 before:content-['•'] before:text-emerald-500"
                >
                  {signal}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {employers.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Employers
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Tenure</th>
                  <th className="py-2 pr-4">6m growth</th>
                  <th className="py-2 pr-4">12m growth</th>
                  <th className="py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {employers.map((row) => (
                  <tr key={row.companyName + (row.role || '')} className="border-b border-slate-50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{row.companyName}</td>
                    <td className="py-3 pr-4 text-slate-600">{row.role || '—'}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {row.durationMonths != null ? `${row.durationMonths} mo` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {formatPercent(row.employeeGrowth6m)}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {formatPercent(row.employeeGrowth12m)}
                    </td>
                    <td className="py-3 font-semibold text-slate-900">
                      {row.employerScore ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.experiences?.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Parsed experience
          </h3>
          <ul className="mt-4 space-y-3">
            {data.experiences.map((exp) => (
              <li
                key={exp.id}
                className="rounded-xl border border-slate-100 px-4 py-3 text-sm text-slate-600"
              >
                <p className="font-medium text-slate-900">{exp.companyName}</p>
                <p>{exp.role || 'Role not specified'}</p>
                <p className="text-xs text-slate-400">
                  {formatDate(exp.startDate)} — {formatDate(exp.endDate)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.warnings?.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Partial enrichment</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SignalPill({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{value}</p>
    </div>
  );
}
