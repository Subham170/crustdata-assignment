import fs from 'fs/promises';
import { prisma } from '../config/db.js';
import { parseResumeDate } from '../utils/dateUtils.js';
import { getResumeAbsolutePath } from '../middlewares/upload.js';

export async function createCandidate({ resumeUrl, linkedinUrl }) {
  return prisma.candidate.create({
    data: {
      resumeUrl,
      linkedinUrl: linkedinUrl ?? null,
      status: 'UPLOADED',
    },
  });
}

/**
 * @param {string} candidateId
 * @param {{ name?: string | null, email?: string | null }} profile
 */
export async function updateCandidateProfile(candidateId, profile) {
  const data = {};
  if (profile.name !== undefined) data.name = profile.name;
  if (profile.email !== undefined) data.email = profile.email;
  if (Object.keys(data).length === 0) return null;

  return prisma.candidate.update({
    where: { id: candidateId },
    data,
  });
}

export async function listCandidates(limit = 100) {
  const candidates = await prisma.candidate.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      growthReports: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return candidates.map((candidate) => {
    const [report] = candidate.growthReports;
    return {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      linkedinUrl: candidate.linkedinUrl,
      status: candidate.status.toLowerCase(),
      growthScore: report?.growthScore ?? null,
      scoreBand: report?.scoreBand ?? null,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };
  });
}

/**
 * @param {string} candidateId
 * @param {{ name?: string | null, email?: string | null, linkedinUrl?: string | null }} fields
 */
export async function updateCandidate(candidateId, fields) {
  const data = {};
  if (fields.name !== undefined) data.name = fields.name?.trim() || null;
  if (fields.email !== undefined) data.email = fields.email?.trim() || null;
  if (fields.linkedinUrl !== undefined) data.linkedinUrl = fields.linkedinUrl || null;
  if (Object.keys(data).length === 0) return getCandidateById(candidateId);

  return prisma.candidate.update({
    where: { id: candidateId },
    data,
  });
}

/**
 * @param {string} candidateId
 */
export async function deleteCandidate(candidateId) {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return null;

  await prisma.candidate.delete({ where: { id: candidateId } });

  try {
    await fs.unlink(getResumeAbsolutePath(candidate.resumeUrl));
  } catch {
    // Resume file may already be missing
  }

  return candidate;
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

/**
 * @param {string} candidateId
 * @param {{ growthScore: number, scoreBand: string, employerScores: object, aiSummary?: string | null, signals?: object | null }} report
 */
export async function saveGrowthReport(candidateId, report) {
  await prisma.$transaction(async (tx) => {
    await tx.growthReport.deleteMany({ where: { candidateId } });

    await tx.growthReport.create({
      data: {
        candidateId,
        growthScore: report.growthScore,
        scoreBand: report.scoreBand,
        employerScores: report.employerScores,
        aiSummary: report.aiSummary ?? null,
        signals: report.signals ?? null,
      },
    });

    await tx.candidate.update({
      where: { id: candidateId },
      data: { status: 'COMPLETED' },
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
