'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { compareCandidates, listCandidates } from '@/lib/api';
import { getRecentCandidates } from '@/lib/storage';
import { formatPercent } from '@/lib/format';
import GrowthScoreDisplay from './GrowthScoreDisplay';
import LoadingBlock from './LoadingBlock';
import ErrorAlert from './ErrorAlert';

const MAX_COMPARE = 10;
const MIN_COMPARE = 2;

export default function ComparePanel() {
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
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
            : `Could not load candidates (${err.message}). Upload & analyze resumes first.`
        );
      } finally {
        setLoadingList(false);
      }
    }

    loadCandidates();

    const presetA = searchParams.get('a');
    const presetB = searchParams.get('b');
    const presets = [presetA, presetB].filter(Boolean);
    if (presets.length) setSelectedIds(presets);
  }, [searchParams]);

  const completedCandidates = candidates.filter((c) => c.status === 'completed');

  function toggleCandidate(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  async function handleCompare(event) {
    event.preventDefault();

    if (selectedIds.length < MIN_COMPARE) {
      setError(`Select at least ${MIN_COMPARE} candidates.`);
      return;
    }
    if (selectedIds.length > MAX_COMPARE) {
      setError(`You can compare at most ${MAX_COMPARE} candidates.`);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await compareCandidates(selectedIds);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const winnerProfile = result?.comparison?.candidates?.find(
    (c) => c.id === result.winnerId
  );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Select candidates</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose {MIN_COMPARE}–{MAX_COMPARE} analyzed candidates (
          <span className="font-medium">completed</span>). {completedCandidates.length} ready
          · {selectedIds.length} selected
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
              , run <strong>Analyze</strong>, then return here.
            </p>
          </div>
        )}

        {listError && !loadingList && (
          <p className="mt-4 text-sm text-amber-800">{listError}</p>
        )}

        {!loadingList && candidates.length > 0 && (
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-2">
            {candidates.map((item) => {
              const isCompleted = item.status === 'completed';
              const isSelected = selectedIds.includes(item.id);
              const atMax = selectedIds.length >= MAX_COMPARE && !isSelected;

              return (
                <li key={item.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                    } ${!isCompleted || atMax ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isCompleted || atMax}
                      onChange={() => toggleCandidate(item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-slate-900">
                        {item.name || 'Unnamed'}
                      </span>
                      {item.growthScore != null && item.scoreBand && (
                        <span className="ml-2 text-xs tabular-nums text-slate-500">
                          {item.growthScore}/100
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status || 'unknown'}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={handleCompare} className="mt-6 space-y-4">
          {error && <ErrorAlert message={error} />}

          <button
            type="submit"
            disabled={
              loading ||
              loadingList ||
              selectedIds.length < MIN_COMPARE ||
              selectedIds.length > MAX_COMPARE
            }
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? 'Comparing…'
              : `Compare ${selectedIds.length || ''} candidate${selectedIds.length === 1 ? '' : 's'}`.trim()}
          </button>
        </form>
      </section>

      {loading && <LoadingBlock title="Building comparison…" />}

      {result && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Recommended hire (#1)
            </p>
            <p className="mt-2 text-xl font-bold text-emerald-900">
              {winnerProfile?.name || 'Unnamed'}
            </p>
          </div>

          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-sm">
            {result.comparison.recommendation}
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.comparison.candidates.map((profile) => (
              <CompareCard
                key={profile.id}
                profile={profile}
                isWinner={profile.id === result.winnerId}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CompareCard({ profile, isWinner }) {
  return (
    <article
      className={`rounded-2xl border bg-white p-6 shadow-sm ${
        isWinner ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Rank #{profile.rank}
        </p>
        {isWinner && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            Top pick
          </span>
        )}
      </div>

      <h3 className="mt-2 text-lg font-bold text-slate-900">{profile.name || 'Unnamed'}</h3>
      <Link
        href={`/candidates/${profile.id}`}
        className="mt-1 inline-block font-mono text-xs text-slate-400 hover:text-slate-600"
      >
        View profile
      </Link>

      <div className="mt-4">
        <GrowthScoreDisplay score={profile.growthScore} band={profile.scoreBand} />
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
