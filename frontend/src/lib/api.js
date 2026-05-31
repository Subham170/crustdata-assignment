const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data.details;
    error.retryAfter = data.retryAfter;
    throw error;
  }

  return data;
}

export async function uploadResume(file, linkedinUrl = '') {
  const formData = new FormData();
  formData.append('resume', file);
  if (linkedinUrl) formData.append('linkedinUrl', linkedinUrl);

  const response = await fetch(`${API_BASE}/api/candidates/upload`, {
    method: 'POST',
    body: formData,
  });

  return parseResponse(response);
}

export async function analyzeCandidate(candidateId) {
  const response = await fetch(`${API_BASE}/api/candidates/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId }),
  });

  return parseResponse(response);
}

export async function listCandidates(limit = 100) {
  const response = await fetch(`${API_BASE}/api/candidates?limit=${limit}`, {
    cache: 'no-store',
  });
  return parseResponse(response);
}

export async function updateCandidate(candidateId, data) {
  const response = await fetch(`${API_BASE}/api/candidates/${candidateId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  return parseResponse(response);
}

export async function deleteCandidate(candidateId) {
  const response = await fetch(`${API_BASE}/api/candidates/${candidateId}`, {
    method: 'DELETE',
  });

  return parseResponse(response);
}

export async function getCandidate(candidateId) {
  const response = await fetch(`${API_BASE}/api/candidates/${candidateId}`, {
    cache: 'no-store',
  });

  return parseResponse(response);
}

export async function compareCandidates(candidate1, candidate2) {
  const response = await fetch(`${API_BASE}/api/candidates/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate1, candidate2 }),
  });

  return parseResponse(response);
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
  return parseResponse(response);
}
