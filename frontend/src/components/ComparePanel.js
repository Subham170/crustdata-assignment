'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { compareCandidates, listCandidates } from '@/lib/api';
import { getRecentCandidates } from '@/lib/storage';
import { formatPercent } from '@/lib/format';
import ScoreBadge from './ScoreBadge';
import LoadingBlock from './LoadingBlock';
import ErrorAlert from './ErrorAlert';

export default function ComparePanel() {
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [candidate1, setCandidate1] = useState('');
  const [candidate2, setCandidate2] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  useEffect(() => {
    async function loadCandidates() {
      setLoadingList(true);
      setListError('');

      try {
        const { candidates: fromApi } = await listCandidates();
        setCandidates(fromApi);
      } catch (err) {
        const fallback = getRecentCandidates();
        setCandidates(
          fallback.map((item) => ({
            id: item.id,
            name: item.name,
            status: 'unknown',
            growthScore: null,
          }))
        );
        setListError(
          fallback.length
            ? `Could not load from server (${err.message}). Showing browser-only recent list.`
            : `Could not load candidates (${err.message}). Upload & analyze resumes first, or paste UUIDs below.`
        );
      } finally {
        setLoadingList(false);
      }
    }

    loadCandidates();

    const presetA = searchParams.get('a');
    const presetB = searchParams.get('b');
    if (presetA) setCandidate1(presetA);
    if (presetB) setCandidate2(presetB);
  }, [searchParams]);

  useEffect(() => {
    if (!candidate2 && candidates.length > 1) {
      const second = candidates.find((c) => c.id !== candidate1);
      if (second) setCandidate2(second.id);
    }
  }, [candidates, candidate1, candidate2]);

  const completedCount = candidates.filter((c) => c.status === 'completed').length;

  async function handleCompare(event) {
    event.preventDefault();

    if (!candidate1 || !candidate2) {
      setError('Select or enter both candidate IDs.');
      return;
    }

    if (candidate1 === candidate2) {
      setError('Choose two different candidates.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await compareCandidates(candidate1, candidate2);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Select candidates</h2>
        <p className="mt-1 text-sm text-slate-500">
          Both must be analyzed (<span className="font-medium">completed</span>). Loaded from
          your database — {completedCount} ready to compare.
        </p>

        {loadingList && (
          <p className="mt-4 text-sm text-slate-500">Loading candidates from API…</p>
        )}

        {!loadingList && candidates.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            <p className="font-medium text-slate-900">No candidates yet</p>
            <p className="mt-2">
              Upload a resume on the{' '}
              <Link href="/" className="font-medium text-slate-900 underline">
                home page
              </Link>
              , run <strong>Analyze</strong>, then return here. Or paste UUIDs below if you
              analyzed via Postman.
            </p>
          </div>
        )}

        {listError && !loadingList && (
          <p className="mt-4 text-sm text-amber-800">{listError}</p>
        )}

        <form onSubmit={handleCompare} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CandidateSelect
              label="Candidate A"
              value={candidate1}
              onChange={setCandidate1}
              candidates={candidates}
              disabled={loadingList}
            />
            <CandidateSelect
              label="Candidate B"
              value={candidate2}
              onChange={setCandidate2}
              candidates={candidates}
              disabled={loadingList}
            />
          </div>

          {error && <ErrorAlert message={error} />}

          <button
            type="submit"
            disabled={loading || loadingList}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Comparing…' : 'Compare candidates'}
          </button>
        </form>
      </section>

      {loading && <LoadingBlock title="Building comparison…" />}

      {result && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Recommended hire
            </p>
            <p className="mt-2 text-xl font-bold text-emerald-900">
              {result.winner === 'candidate1'
                ? result.comparison.candidate1.name
                : result.comparison.candidate2.name}
            </p>
          </div>

          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-sm">
            {result.comparison.recommendation}
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <CompareCard
              label="Candidate A"
              profile={result.comparison.candidate1}
              isWinner={result.winner === 'candidate1'}
            />
            <CompareCard
              label="Candidate B"
              profile={result.comparison.candidate2}
              isWinner={result.winner === 'candidate2'}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function CandidateSelect({ label, value, onChange, candidates, disabled }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
      >
        <option value="">Select a candidate…</option>
        {candidates.map((item) => (
          <option
            key={item.id}
            value={item.id}
            disabled={item.status !== 'completed'}
          >
            {formatCandidateOption(item)}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste candidate UUID"
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-900/10"
      />
    </label>
  );
}

function formatCandidateOption(item) {
  const name = item.name || 'Unnamed';
  const status = item.status || 'unknown';
  if (status === 'completed' && item.growthScore != null) {
    return `${name} — score ${item.growthScore} (${status})`;
  }
  if (status !== 'completed') {
    return `${name} — ${status} (run analyze first)`;
  }
  return `${name} (${status})`;
}

function CompareCard({ label, profile, isWinner }) {
  return (
    <article
      className={`rounded-2xl border bg-white p-6 shadow-sm ${
        isWinner ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {isWinner && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            Winner
          </span>
        )}
      </div>

      <h3 className="mt-2 text-lg font-bold text-slate-900">{profile.name || 'Unnamed'}</h3>
      <Link
        href={`/candidates/${profile.id}`}
        className="mt-1 inline-block font-mono text-xs text-slate-400 hover:text-slate-600"
      >
        {profile.id}
      </Link>

      <div className="mt-4">
        <ScoreBadge band={profile.scoreBand} score={profile.growthScore} />
      </div>

      <dl className="mt-6 space-y-2 text-sm">
        <MetricRow label="Avg 6m employer growth" value={formatPercent(profile.avgEmployerGrowth6m)} />
        <MetricRow label="Startup readiness" value={profile.startupReadiness} />
        <MetricRow label="Enterprise readiness" value={profile.enterpriseReadiness} />
        <MetricRow
          label="Avg tenure (months)"
          value={profile.careerStabilityMonths ?? '—'}
        />
        <MetricRow label="Employers scored" value={profile.employerCount ?? '—'} />
      </dl>
    </article>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium capitalize text-slate-900">{value ?? '—'}</dd>
    </div>
  );
}
