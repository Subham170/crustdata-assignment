import { prisma } from '../config/db.js';
import { parseResumeDate } from '../utils/dateUtils.js';

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
        include: { companyGrowth: true },
      },
      growthReports: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function updateCandidateStatus(candidateId, status) {
  return prisma.candidate.update({
    where: { id: candidateId },
    data: { status },
  });
}

/**
 * @param {string} candidateId
 * @param {{ name: string | null, email: string | null, experiences: Array<{ companyName: string, role: string | null, startDate: string | null, endDate: string | null }> }} parsed
 */
export async function persistParsedResume(candidateId, parsed) {
  const experienceRows = parsed.experiences.map((exp) => ({
    companyName: exp.companyName,
    role: exp.role,
    startDate: parseResumeDate(exp.startDate),
    endDate: parseResumeDate(exp.endDate),
  }));

  return prisma.$transaction(async (tx) => {
    await tx.experience.deleteMany({ where: { candidateId } });

    await tx.candidate.update({
      where: { id: candidateId },
      data: {
        name: parsed.name,
        email: parsed.email,
        status: 'UPLOADED',
      },
    });

    if (experienceRows.length > 0) {
      await tx.experience.createMany({
        data: experienceRows.map((row) => ({
          candidateId,
          ...row,
        })),
      });
    }

    return tx.candidate.findUnique({
      where: { id: candidateId },
      include: {
        experiences: { orderBy: { startDate: 'desc' } },
      },
    });
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
      crustdataCompanyId: exp.crustdataCompanyId,
      companyGrowth: exp.companyGrowth
        ? {
            id: exp.companyGrowth.id,
            companyName: exp.companyGrowth.companyName,
            employeeGrowth6m: exp.companyGrowth.employeeGrowth6m,
            employeeGrowth12m: exp.companyGrowth.employeeGrowth12m,
            headcountTotal: exp.companyGrowth.headcountTotal,
            totalInvestmentUsd: exp.companyGrowth.totalInvestmentUsd,
            yearFounded: exp.companyGrowth.yearFounded,
            industry: exp.companyGrowth.industry,
          }
        : null,
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
