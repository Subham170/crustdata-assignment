import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseResumeText,
  mergeParsedResults,
} from '../src/services/resumeParserService.js';
import { parseResumeDate, monthsBetween } from '../src/utils/dateUtils.js';
import {
  standardResumeText,
  pipeDelimitedResumeText,
  trailingDateResumeText,
  noExperienceResumeText,
} from './fixtures/resume-samples.js';

describe('dateUtils', () => {
  it('parses ISO and month-year dates', () => {
    const jan2021 = parseResumeDate('2021-01');
    assert.equal(jan2021?.getUTCFullYear(), 2021);
    assert.equal(jan2021?.getUTCMonth(), 0);

    const jun2024 = parseResumeDate('Jun 2024');
    assert.equal(jun2024?.getUTCFullYear(), 2024);
    assert.equal(jun2024?.getUTCMonth(), 5);
  });

  it('treats present as null end date', () => {
    assert.equal(parseResumeDate('Present'), null);
  });

  it('computes months between dates', () => {
    const start = parseResumeDate('2021-01');
    const end = parseResumeDate('2024-06');
    assert.equal(monthsBetween(start, end), 41);
  });
});

describe('resumeParserService merge', () => {
  it('prefers LLM experiences and fills name/email from either source', () => {
    const heuristic = parseResumeText(noExperienceResumeText);
    const llm = {
      name: 'Subham Dey',
      email: 'subham@example.com',
      experiences: [
        {
          companyName: 'LEAN AI',
          role: 'Backend Engineer',
          startDate: '2025-11',
          endDate: '2026-01',
        },
      ],
    };

    const merged = mergeParsedResults(heuristic, llm);
    assert.equal(merged.name, 'Subham Dey');
    assert.equal(merged.experiences.length, 1);
    assert.equal(merged.experiences[0].companyName, 'LEAN AI');
  });
});

describe('resumeParserService regex fallback', () => {
  it('extracts name, email, and role-at-company experiences', () => {
    const parsed = parseResumeText(standardResumeText);

    assert.equal(parsed.name, 'Jane Doe');
    assert.equal(parsed.email, 'jane.doe@example.com');
    assert.equal(parsed.experiences.length, 2);

    const razorpay = parsed.experiences.find((e) => e.companyName === 'Razorpay');
    assert.ok(razorpay);
    assert.equal(razorpay.role, 'Software Engineer');
    assert.equal(razorpay.startDate, '2021-01');
    assert.equal(razorpay.endDate, '2024-06');

    const swiggy = parsed.experiences.find((e) => e.companyName === 'Swiggy');
    assert.ok(swiggy);
    assert.equal(swiggy.role, 'Product Engineer');
    assert.equal(swiggy.startDate, '2018-07');
    assert.equal(swiggy.endDate, '2020-12');
  });

  it('parses pipe-delimited work history blocks', () => {
    const parsed = parseResumeText(pipeDelimitedResumeText);

    assert.equal(parsed.name, 'John Smith');
    assert.equal(parsed.email, 'john.smith@company.io');
    assert.equal(parsed.experiences.length, 2);

    const google = parsed.experiences.find((e) => e.companyName === 'Google');
    assert.ok(google);
    assert.equal(google.role, 'Senior Software Engineer');
    assert.equal(google.startDate, '2020-01');
    assert.equal(google.endDate, null);

    const microsoft = parsed.experiences.find((e) => e.companyName === 'Microsoft');
    assert.ok(microsoft);
    assert.equal(microsoft.startDate, '2016-06');
    assert.equal(microsoft.endDate, '2019-12');
  });

  it('parses company lines with trailing date ranges', () => {
    const parsed = parseResumeText(trailingDateResumeText);

    assert.equal(parsed.experiences.length, 2);

    const leanAi = parsed.experiences.find((e) => e.companyName.includes('LEAN AI'));
    assert.ok(leanAi);
    assert.match(leanAi.role ?? '', /Backend/i);
    assert.equal(leanAi.startDate, '2025-11');
    assert.equal(leanAi.endDate, '2026-01');

    const builder = parsed.experiences.find((e) => e.companyName === 'Builder Mitr');
    assert.ok(builder);
    assert.equal(builder.startDate, '2025-06');
    assert.equal(builder.endDate, '2025-09');
  });

  it('returns no experiences when work history is missing', () => {
    const parsed = parseResumeText(noExperienceResumeText);
    assert.equal(parsed.experiences.length, 0);
  });
});
