'use client';

import { useEffect, useState } from 'react';
import { checkHealth } from '@/lib/api';

export default function ApiStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    checkHealth()
      .then((data) => setStatus(data.status === 'ok' ? 'online' : 'degraded'))
      .catch(() => setStatus('offline'));
  }, []);

  const styles = {
    checking: 'bg-slate-100 text-slate-600',
    online: 'bg-emerald-50 text-emerald-800',
    degraded: 'bg-amber-50 text-amber-800',
    offline: 'bg-red-50 text-red-800',
  };

  const labels = {
    checking: 'Checking API…',
    online: 'API connected',
    degraded: 'API degraded',
    offline: 'API offline',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          status === 'online'
            ? 'bg-emerald-500'
            : status === 'offline'
              ? 'bg-red-500'
              : 'bg-amber-500'
        }`}
      />
      {labels[status]}
    </span>
  );
}
