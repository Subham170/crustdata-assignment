const STORAGE_KEY = 'growthlens_recent_candidates';

export function getRecentCandidates() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentCandidate({ id, name, email }) {
  const existing = getRecentCandidates().filter((item) => item.id !== id);
  const next = [
    { id, name: name || 'Unnamed candidate', email, savedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, 8);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function updateRecentCandidate(id, updates) {
  const next = getRecentCandidates().map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
