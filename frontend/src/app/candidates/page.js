import CandidatesPanel from '@/components/CandidatesPanel';

export default function CandidatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Candidates</h1>
        <p className="mt-2 text-slate-600">
          All uploaded candidates. Edit profile details or remove records you no longer need.
        </p>
      </div>

      <CandidatesPanel />
    </div>
  );
}
