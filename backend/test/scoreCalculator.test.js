import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  normalizeFunding,
  tenureScore,
  getScoreBand,
  computeEmployerScore,
  computeEmployerScores,
  computeAggregateScore,
} from '../src/utils/scoreCalculator.js';

describe('scoreCalculator', () => {
  it('normalizes growth percentages into 0–100', () => {
    assert.equal(normalize(25, 0, 50), 50);
    assert.equal(normalize(50, 0, 50), 100);
    assert.equal(normalize(-10, 0, 50), 0);
  });

  it('maps score to bands', () => {
    assert.equal(getScoreBand(20), 'stable');
    assert.equal(getScoreBand(45), 'moderate');
    assert.equal(getScoreBand(70), 'fast');
    assert.equal(getScoreBand(90), 'hypergrowth');
  });

  it('computes employer score from growth + tenure', () => {
    const score = computeEmployerScore(
      {
        employeeGrowth6m: 25,
        employeeGrowth12m: 40,
        totalInvestmentUsd: 100_000_000,
      },
      36
    );

    assert.ok(score > 0 && score <= 100);
  });

  it('computes tenure-weighted aggregate score', () => {
    const aggregate = computeAggregateScore([
      { employerScore: 80, durationMonths: 24 },
      { employerScore: 40, durationMonths: 12 },
    ]);

    assert.equal(aggregate, 67);
  });

  it('builds employer score rows from experiences', () => {
    const rows = computeEmployerScores([
      {
        id: 'exp-1',
        companyName: 'Razorpay',
        role: 'Engineer',
        startDate: new Date('2021-01-01'),
        endDate: new Date('2024-01-01'),
        companyGrowth: {
          employeeGrowth6m: 17,
          employeeGrowth12m: 33,
          headcountTotal: 4000,
          totalInvestmentUsd: 500_000_000,
        },
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].companyName, 'Razorpay');
    assert.ok(rows[0].employerScore > 0);
    assert.equal(rows[0].durationMonths, 36);
  });
});
