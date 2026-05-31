import { Suspense } from 'react';
import ComparePanel from '@/components/ComparePanel';
import LoadingBlock from '@/components/LoadingBlock';

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Compare candidates</h1>
        <p className="mt-2 text-slate-600">
          Select 2–10 analyzed candidates for ranked growth exposure comparison and a hiring
          recommendation.
        </p>
      </div>

      <Suspense fallback={<LoadingBlock title="Loading…" />}>
        <ComparePanel />
      </Suspense>
    </div>
  );
}
