'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listCandidates } from '@/lib/api';
import { getRecentCandidates } from '@/lib/storage';

export default function RecentCandidates() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { candidates } = await listCandidates();
        setItems(candidates.slice(0, 8));
      } catch {
        setItems(getRecentCandidates());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading recent candidates…</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        <p className="font-medium text-slate-900">No candidates yet</p>
        <p className="mt-2">Upload a resume to get started.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100/80">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Recent candidates
      </h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/candidates/${item.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm transition hover:border-slate-200 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">
                {item.name || 'Unnamed'}
                {item.status && (
                  <span className="ml-2 text-xs font-normal capitalize text-slate-400">
                    {item.status}
                  </span>
                )}
              </span>
              <span className="font-mono text-xs text-slate-400">{item.id.slice(0, 8)}…</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
