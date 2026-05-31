'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { analyzeCandidate, getCandidate } from '@/lib/api';
import { addRecentCandidate, updateRecentCandidate } from '@/lib/storage';
import CandidateProfile from './CandidateProfile';
import AnalysisResults from './AnalysisResults';
import LoadingBlock from './LoadingBlock';
import ErrorAlert from './ErrorAlert';

export default function CandidateView({ candidateId }) {
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const loadCandidate = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getCandidate(candidateId);
      setData(result);

      if (result.report) {
        setAnalysis({
          growthScore: result.report.growthScore,
          scoreBand: result.report.scoreBand,
          summary: result.report.aiSummary,
          signals: result.report.signals,
          employers: result.report.employerScores,
          experiences: result.experiences,
        });
      }

      addRecentCandidate({
        id: result.candidate.id,
        name: result.candidate.name,
        email: result.candidate.email,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    loadCandidate();
  }, [loadCandidate]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');

    try {
      const result = await analyzeCandidate(candidateId);
      setAnalysis(result);
      updateRecentCandidate(candidateId, {
        name: result.name || 'Unnamed candidate',
        email: result.email,
      });
      await loadCandidate();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return <LoadingBlock title="Loading candidate…" />;
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <ErrorAlert message={error} onRetry={loadCandidate} />
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to upload
        </Link>
      </div>
    );
  }

  const candidate = data?.candidate;
  const isCompleted = candidate?.status === 'completed';
  const canAnalyze = !analyzing && candidate?.status !== 'parsing' && candidate?.status !== 'analyzing';

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Back to upload
      </Link>

      <CandidateProfile candidate={candidate} />

      {!isCompleted && !analyzing && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Run growth analysis</h2>
          <p className="mt-2 text-sm text-slate-500">
            Parses the resume, enriches employers with Crustdata, computes a Growth Exposure
            Score, and generates AI hiring signals. This usually takes 30–60 seconds.
          </p>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Analyze candidate
          </button>
        </section>
      )}

      {analyzing && (
        <LoadingBlock
          title="Analyzing candidate…"
          message="Parsing resume, enriching employers, scoring, and generating insights. Please wait."
        />
      )}

      {error && <ErrorAlert message={error} onRetry={isCompleted ? loadCandidate : handleAnalyze} />}

      {analysis && !analyzing && <AnalysisResults data={analysis} />}

      {isCompleted && (
        <div className="flex justify-end">
          <Link
            href={`/compare?a=${candidateId}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Compare with another candidate →
          </Link>
        </div>
      )}
    </div>
  );
}
