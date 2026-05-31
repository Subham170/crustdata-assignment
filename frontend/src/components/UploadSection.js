'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadResume } from '@/lib/api';
import { addRecentCandidate } from '@/lib/storage';
import ErrorAlert from './ErrorAlert';

export default function UploadSection() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError('Please select a PDF resume.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await uploadResume(file, linkedinUrl.trim());
      addRecentCandidate({ id: result.candidateId, name: null, email: null });
      router.push(`/candidates/${result.candidateId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100/80">
      <h2 className="text-lg font-semibold text-slate-900">Upload resume</h2>
      <p className="mt-1 text-sm text-slate-500">
        PDF only. We extract employers, enrich with Crustdata, and score growth exposure.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Resume (PDF)</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">LinkedIn URL (optional)</span>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/username"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none ring-slate-900/0 transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        {error && <ErrorAlert message={error} />}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Uploading…' : 'Upload & continue'}
        </button>
      </form>
    </section>
  );
}
