import { prisma } from '../config/db.js';

export async function createCandidate({ resumeUrl, linkedinUrl }) {
  return prisma.candidate.create({
    data: {
      resumeUrl,
      linkedinUrl: linkedinUrl ?? null,
      status: 'UPLOADED',
    },
  });
}

export async function getCandidateById(id) {
  return prisma.candidate.findUnique({
    where: { id },
    include: {
      experiences: {
        orderBy: { startDate: 'desc' },
      },
      growthReports: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export function formatCandidateResponse(candidate) {
  const [latestReport] = candidate.growthReports;

  return {
    candidate: {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      linkedinUrl: candidate.linkedinUrl,
      resumeUrl: candidate.resumeUrl,
      status: candidate.status.toLowerCase(),
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    },
    experiences: candidate.experiences.map((exp) => ({
      id: exp.id,
      companyName: exp.companyName,
      role: exp.role,
      startDate: exp.startDate,
      endDate: exp.endDate,
    })),
    report: latestReport
      ? {
          id: latestReport.id,
          growthScore: latestReport.growthScore,
          scoreBand: latestReport.scoreBand,
          aiSummary: latestReport.aiSummary,
          signals: latestReport.signals,
          employerScores: latestReport.employerScores,
          createdAt: latestReport.createdAt,
        }
      : null,
  };
}
