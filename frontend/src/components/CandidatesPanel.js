'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { deleteCandidate, listCandidates, updateCandidate } from '@/lib/api';
import { removeRecentCandidate, updateRecentCandidate } from '@/lib/storage';
import GrowthScoreDisplay from './GrowthScoreDisplay';
import LoadingBlock from './LoadingBlock';
import ErrorAlert from './ErrorAlert';

const STATUS_STYLES = {
  uploaded: 'bg-slate-100 text-slate-700',
  parsing: 'bg-sky-50 text-sky-800',
  analyzing: 'bg-amber-50 text-amber-800',
  completed: 'bg-emerald-50 text-emerald-800',
  failed: 'bg-red-50 text-red-800',
};

function toEditForm(candidate) {
  return {
    id: candidate.id,
    name: candidate.name || '',
    email: candidate.email || '',
    linkedinUrl: candidate.linkedinUrl || '',
  };
}

function formsEqual(a, b) {
  if (!a || !b) return true;
  return (
    a.name === b.name && a.email === b.email && a.linkedinUrl === b.linkedinUrl
  );
}

export default function CandidatesPanel() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchCandidates = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true);
    setError('');

    try {
      const { candidates: list } = await listCandidates();
      setCandidates(list);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showFullLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates(true);
  }, [fetchCandidates]);

  const hasEditChanges = useMemo(
    () => editForm && editSnapshot && !formsEqual(editForm, editSnapshot),
    [editForm, editSnapshot]
  );

  function openEdit(candidate) {
    const form = toEditForm(candidate);
    setEditSnapshot(form);
    setEditForm({ ...form });
  }

  function closeEdit() {
    setEditForm(null);
    setEditSnapshot(null);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!editForm || !hasEditChanges) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        linkedinUrl: editForm.linkedinUrl.trim(),
      };
      const { candidate } = await updateCandidate(editForm.id, payload);

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id
            ? {
                ...c,
                name: candidate.name,
                email: candidate.email,
                linkedinUrl: candidate.linkedinUrl,
              }
            : c
        )
      );

      updateRecentCandidate(editForm.id, {
        name: candidate.name || 'Unnamed candidate',
        email: candidate.email,
      });

      closeEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const id = deleteTarget.id;
    setDeletingId(id);
    setError('');

    try {
      await deleteCandidate(id);
      removeRecentCandidate(id);
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      if (editForm?.id === id) closeEdit();
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <LoadingBlock title="Loading candidates…" />;
  }

  return (
    <div className="space-y-6">
      {error && <ErrorAlert message={error} onRetry={() => fetchCandidates(false)} />}

      {candidates.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
          <p className="font-medium text-slate-900">No candidates yet</p>
          <p className="mt-2 text-sm text-slate-600">
            <Link href="/" className="font-medium text-slate-900 underline">
              Upload a resume
            </Link>{' '}
            to create your first candidate.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Growth exposure</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map((candidate) => {
                  const status = candidate.status?.toLowerCase() || 'uploaded';
                  return (
                    <tr key={candidate.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {candidate.name || 'Unnamed'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {candidate.email || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] || STATUS_STYLES.uploaded}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {candidate.growthScore != null && candidate.scoreBand ? (
                          <GrowthScoreDisplay
                            score={candidate.growthScore}
                            band={candidate.scoreBand}
                          />
                        ) : candidate.status === 'completed' ? (
                          <span className="text-xs text-slate-500">No score</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Link
                            href={`/candidates/${candidate.id}`}
                            aria-label={`View ${candidate.name || 'candidate'}`}
                            title="View"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                          >
                            <EyeIcon />
                          </Link>
                          <button
                            type="button"
                            aria-label={`Edit ${candidate.name || 'candidate'}`}
                            title="Edit"
                            onClick={() => openEdit(candidate)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${candidate.name || 'candidate'}`}
                            title="Delete"
                            onClick={() => setDeleteTarget(candidate)}
                            disabled={deletingId === candidate.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingId === candidate.id ? (
                              <SpinnerIcon />
                            ) : (
                              <TrashIcon />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-candidate-title"
          onClick={closeEdit}
        >
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h2 id="edit-candidate-title" className="text-lg font-semibold text-slate-900">
              Edit candidate
            </h2>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="optional"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">LinkedIn URL</span>
                <input
                  type="url"
                  value={editForm.linkedinUrl}
                  onChange={(e) =>
                    setEditForm({ ...editForm, linkedinUrl: e.target.value })
                  }
                  placeholder="https://www.linkedin.com/in/username"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !hasEditChanges}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-candidate-title"
          aria-describedby="delete-candidate-desc"
          onClick={() => !deletingId && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
              <TrashIcon />
            </div>
            <h2 id="delete-candidate-title" className="mt-4 text-lg font-semibold text-slate-900">
              Delete candidate?
            </h2>
            <p id="delete-candidate-desc" className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">
                {deleteTarget.name || 'Unnamed'}
              </span>{' '}
              will be removed permanently, including their resume and analysis data.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={!!deletingId}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!!deletingId}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
