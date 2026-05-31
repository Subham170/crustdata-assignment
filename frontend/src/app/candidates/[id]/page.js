import CandidateView from '@/components/CandidateView';

export default async function CandidatePage({ params }) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CandidateView candidateId={id} />
    </div>
  );
}
