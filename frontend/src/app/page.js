import ApiStatus from '@/components/ApiStatus';
import UploadSection from '@/components/UploadSection';
import RecentCandidates from '@/components/RecentCandidates';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <section className="mb-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Hire for growth exposure
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600">
              Upload a resume to extract employers, enrich headcount and funding data via
              Crustdata, and generate a Growth Exposure Score with AI hiring insights.
            </p>
          </div>
          <ApiStatus />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <UploadSection />
        </div>
        <div className="lg:col-span-2">
          <RecentCandidates />
        </div>
      </div>
    </div>
  );
}
