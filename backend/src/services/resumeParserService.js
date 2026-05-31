import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import { parseResumeDate } from '../utils/dateUtils.js';
import { extractResumeWithLlm } from './llmResumeExtractor.js';

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

const EXPERIENCE_SECTION_REGEX =
  /^(experience|work\s+history|professional\s+experience|employment\s+history|employment|career\s+history|internships?)\s*$/i;

const DATE_RANGE_REGEX =
  /([A-Za-z]{3,9}\s+\d{4}|\d{1,2}\/\d{4}|\d{4}-\d{1,2}|\d{4})\s*[-–—to]+\s*([A-Za-z]{3,9}\s+\d{4}|\d{1,2}\/\d{4}|\d{4}-\d{1,2}|\d{4}|present|current|now|ongoing)/i;

const TRAILING_DATE_RANGE_REGEX =
  /([A-Za-z]{3,9}\s+\d{4}|\d{1,2}\/\d{4}|\d{4}-\d{1,2}|\d{4})\s*[-–—to]+\s*([A-Za-z]{3,9}\s+\d{4}|\d{1,2}\/\d{4}|\d{4}-\d{1,2}|\d{4}|present|current|now|ongoing)\s*$/i;

const ROLE_AT_COMPANY_REGEX = /^(.+?)\s+at\s+(.+)$/i;
const BULLET_LINE_REGEX = /^[•\-\*●○]\s*/;

const SKIP_LINE_REGEX =
  /^(email|phone|linkedin|github|skills|education|summary|objective|certifications|projects|languages|interests|references)\b/i;

/**
 * @param {string} filePath
 * @returns {Promise<{ name: string | null, email: string | null, experiences: Array<{ companyName: string, role: string | null, startDate: string | null, endDate: string | null }> }>}
 */
export async function parseResumeFile(filePath) {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return parseResumeWithFallback(result.text);
  } finally {
    await parser.destroy();
  }
}

/**
 * @param {string} rawText
 */
export async function parseResumeWithFallback(rawText) {
  const parsed = parseResumeText(rawText);

  if (parsed.experiences.length > 0) {
    return parsed;
  }

  const llmParsed = await extractResumeWithLlm(rawText);
  if (!llmParsed?.experiences.length) {
    return parsed;
  }

  return {
    name: parsed.name ?? llmParsed.name,
    email: parsed.email ?? llmParsed.email,
    experiences: llmParsed.experiences,
  };
}

/**
 * @param {string} rawText
 */
export function parseResumeText(rawText) {
  const text = normalizeText(rawText);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const email = extractEmail(text);
  const name = extractName(lines, email);
  const experiences = extractExperiences(lines);

  return {
    name,
    email,
    experiences: experiences.map((exp) => ({
      companyName: exp.companyName,
      role: exp.role,
      startDate: exp.startDate ? formatYearMonth(exp.startDate) : null,
      endDate: exp.endDate ? formatYearMonth(exp.endDate) : null,
    })),
  };
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractEmail(text) {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0].toLowerCase() : null;
}

function extractName(lines, email) {
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3 || line.length > 60) continue;
    if (EMAIL_REGEX.test(line)) continue;
    if (/https?:\/\//i.test(line)) continue;
    if (SKIP_LINE_REGEX.test(line)) continue;
    if (EXPERIENCE_SECTION_REGEX.test(line)) break;
    if (/^\d/.test(line)) continue;
    if (/[,|@#]/.test(line)) continue;

    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && /^[A-Za-z]/.test(line)) {
      return line;
    }
  }

  if (email) {
    const local = email.split('@')[0];
    const guess = local
      .replace(/[._-]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return guess || null;
  }

  return null;
}

function extractExperiences(lines) {
  const sectionLines = sliceExperienceSection(lines);
  const sourceLines = sectionLines.length > 0 ? sectionLines : lines;
  const blocks = groupExperienceBlocks(sourceLines);
  const experiences = [];

  for (const block of blocks) {
    const parsed = parseExperienceBlock(block);
    if (parsed) experiences.push(parsed);
  }

  return dedupeExperiences(experiences);
}

function sliceExperienceSection(lines) {
  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (EXPERIENCE_SECTION_REGEX.test(lines[i])) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) return [];

  const section = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (isSectionBoundary(line)) break;
    section.push(line);
  }

  return section;
}

function isSectionBoundary(line) {
  return /^(education|skills|certifications|projects|summary|objective|languages|interests|awards|publications|technical\s+skills|programming|social\s+engagements?|developer\s+tools|fundamentals)\b/i.test(
    line
  );
}

function groupExperienceBlocks(lines) {
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (looksLikeExperienceStart(line) && current.length > 0) {
      blocks.push(current);
      current = [line];
      continue;
    }

    if (looksLikeExperienceStart(line)) {
      current = [line];
      continue;
    }

    if (current.length > 0) {
      current.push(line);
    }
  }

  if (current.length > 0) blocks.push(current);

  return blocks.filter((block) =>
    block.some(
      (line) =>
        ROLE_AT_COMPANY_REGEX.test(line) ||
        isPipeDelimitedExperienceLine(line) ||
        hasTrailingDateRange(line)
    )
  );
}

function looksLikeExperienceStart(line) {
  if (isPipeDelimitedExperienceLine(line)) return true;
  if (ROLE_AT_COMPANY_REGEX.test(line)) return true;
  return hasTrailingDateRange(line);
}

function hasTrailingDateRange(line) {
  const trimmed = line.trim();
  if (trimmed.includes('|') || ROLE_AT_COMPANY_REGEX.test(trimmed)) return false;

  const match = trimmed.match(TRAILING_DATE_RANGE_REGEX);
  if (!match) return false;

  const beforeDates = trimmed.slice(0, match.index).trim();
  return beforeDates.length >= 2;
}

function splitCompanyAndDates(line) {
  const trimmed = line.trim();
  const match = trimmed.match(TRAILING_DATE_RANGE_REGEX);
  if (!match) return null;

  const companyName = trimmed
    .slice(0, match.index)
    .replace(/\s*[-–—]+\s*$/, '')
    .trim();

  return {
    companyName,
    startDate: parseResumeDate(match[1]),
    endDate: parseResumeDate(match[2]),
  };
}

function isPipeDelimitedExperienceLine(line) {
  const parts = line.split('|').map((part) => part.trim());
  return parts.length >= 3 && parts[0].length > 0 && parts[1].length > 0;
}

function parseExperienceBlock(block) {
  const joined = block.join(' ');
  const dateMatch = joined.match(DATE_RANGE_REGEX);

  let startDate = null;
  let endDate = null;

  if (dateMatch) {
    startDate = parseResumeDate(dateMatch[1]);
    endDate = parseResumeDate(dateMatch[2]);
  }

  const headerLine =
    block.find((line) => isPipeDelimitedExperienceLine(line)) ??
    block.find((line) => ROLE_AT_COMPANY_REGEX.test(line)) ??
    block.find((line) => hasTrailingDateRange(line)) ??
    block[0];

  if (!headerLine) return null;

  let companyName = null;
  let role = null;

  if (hasTrailingDateRange(headerLine)) {
    const split = splitCompanyAndDates(headerLine);
    if (!split?.companyName) return null;

    companyName = split.companyName;
    startDate = split.startDate ?? startDate;
    endDate = split.endDate ?? endDate;
    role = extractRoleFromBlock(block);
  } else if (isPipeDelimitedExperienceLine(headerLine)) {
    const parts = headerLine.split('|').map((part) => part.trim());
    companyName = parts[0];
    role = parts[1];
    if (!startDate && parts[2]) {
      const inlineDates = parts.slice(2).join(' ').match(DATE_RANGE_REGEX);
      if (inlineDates) {
        startDate = parseResumeDate(inlineDates[1]);
        endDate = parseResumeDate(inlineDates[2]);
      }
    }
  } else {
    const atMatch = headerLine.match(ROLE_AT_COMPANY_REGEX);
    if (atMatch) {
      role = atMatch[1].trim();
      companyName = atMatch[2].trim();
    } else {
      companyName = headerLine;
      role = extractRoleFromBlock(block);
    }
  }

  companyName = cleanCompanyName(companyName);
  if (!companyName || !isValidCompanyName(companyName)) return null;

  return {
    companyName,
    role: role || null,
    startDate,
    endDate,
  };
}

function extractRoleFromBlock(block) {
  for (let i = 1; i < block.length; i++) {
    const line = block[i];
    if (BULLET_LINE_REGEX.test(line)) continue;
    if (hasTrailingDateRange(line)) continue;
    if (DATE_RANGE_REGEX.test(line) && line.length < 40) continue;

    return (
      line
        .split(/\s*[—–]\s*/)[0]
        .replace(/\s*\(.*\)\s*$/, '')
        .replace(/\s+Live-Demo\s*$/i, '')
        .trim() || null
    );
  }
  return null;
}

function isValidCompanyName(name) {
  if (name.length > 120) return false;
  if (/[.!?]$/.test(name)) return false;
  if (/\b(built|worked|led|developed|managed|designed|implemented)\b/i.test(name)) return false;
  return true;
}

function cleanCompanyName(name) {
  return name
    .replace(/^[-•*]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeExperiences(experiences) {
  const seen = new Set();
  return experiences.filter((exp) => {
    const key = `${exp.companyName.toLowerCase()}|${exp.role ?? ''}|${exp.startDate?.toISOString() ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatYearMonth(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
