import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallbackInsights,
  buildFallbackComparisonRecommendation,
} from '../src/services/llmService.js';
import { pickWinner, rankProfiles } from '../src/services/comparisonService.js';

describe('comparisonService', () => {
  it('picks winner by growth score then avg 6m growth', () => {
    assert.equal(
      pickWinner(
        { growthScore: 70, avgEmployerGrowth6m: 10, careerStabilityMonths: 12 },
        { growthScore: 80, avgEmployerGrowth6m: 5, careerStabilityMonths: 24 }
      ),
      'candidate2'
    );

    assert.equal(
      pickWinner(
        { growthScore: 70, avgEmployerGrowth6m: 20, careerStabilityMonths: 12 },
        { growthScore: 70, avgEmployerGrowth6m: 5, careerStabilityMonths: 24 }
      ),
      'candidate1'
    );
  });
});

describe('llmService fallbacks', () => {
  it('builds fallback insights from score data', () => {
    const insights = buildFallbackInsights({
      name: 'Alice',
      growthScore: 75,
      scoreBand: 'fast',
      employerScores: [
        {
          companyName: 'Razorpay',
          employerScore: 80,
          employeeGrowth12m: 30,
          employeeGrowth6m: 15,
        },
      ],
    });

    assert.ok(insights.summary.includes('Alice'));
    assert.equal(insights.signals.startupReadiness, 'high');
    assert.ok(insights.signals.hiringSignals.length >= 3);
  });

  it('builds fallback comparison recommendation', () => {
    const text = buildFallbackComparisonRecommendation({
      winnerId: 'a',
      ranked: [
        { id: 'a', name: 'Alice', growthScore: 80, scoreBand: 'fast' },
        { id: 'b', name: 'Bob', growthScore: 55, scoreBand: 'moderate' },
      ],
    });

    assert.ok(text.includes('Alice'));
    assert.ok(text.includes('80'));
  });
});

describe('rankProfiles', () => {
  it('orders by growth score then avg 6m growth', () => {
    const ranked = rankProfiles([
      { id: '1', growthScore: 70, avgEmployerGrowth6m: 20, careerStabilityMonths: 12 },
      { id: '2', growthScore: 80, avgEmployerGrowth6m: 5, careerStabilityMonths: 24 },
      { id: '3', growthScore: 70, avgEmployerGrowth6m: 5, careerStabilityMonths: 30 },
    ]);

    assert.deepEqual(
      ranked.map((p) => p.id),
      ['2', '1', '3']
    );
  });
});
