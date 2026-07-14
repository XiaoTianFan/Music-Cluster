import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnnPermutationImportanceView,
} from '../src/lib/annPermutationImportanceView';
import type { AnnPermutationImportanceSummary } from '../src/lib/annPermutationImportance';

function createSummary(rowCount: number): AnnPermutationImportanceSummary {
  return {
    inputKind: 'raw',
    baselineAccuracy: 1,
    rowCount,
    dimensionCount: rowCount,
    summary: 'Top impact: feature-1 drops dataset accuracy by 20.0 pts when permuted.',
    rows: Array.from({ length: rowCount }, (_, index) => ({
      dimensionIndex: index,
      dimensionLabel: `feature-${index + 1}`,
      baselineAccuracy: 1,
      permutedAccuracy: 0.8,
      accuracyDrop: 0.2,
      accuracyDropLabel: '20.0 pts drop',
      impactLabel: 'High impact',
      correctPredictions: 4,
      totalSongs: 5,
      lowConfidenceCount: 0,
      baselineAverageConfidence: 0.9,
      permutedAverageConfidence: 0.8,
      confidenceDrop: 0.1,
      confidenceDropLabel: '10.0 pts confidence drop',
      lowConfidenceDelta: 0,
    })),
  };
}

test('getAnnPermutationImportanceView previews the top rows for larger impact results', () => {
  const view = getAnnPermutationImportanceView(createSummary(7), {
    isExpanded: false,
    limit: 5,
  });

  assert.equal(view.totalCount, 7);
  assert.equal(view.visibleCount, 5);
  assert.equal(view.hiddenCount, 2);
  assert.equal(view.hasHiddenRows, true);
  assert.equal(view.statusLabel, 'Showing top 5 of 7 inputs');
  assert.equal(view.toggleLabel, 'Show all 7 inputs');
  assert.deepEqual(view.rows.map(row => row.dimensionLabel), [
    'feature-1',
    'feature-2',
    'feature-3',
    'feature-4',
    'feature-5',
  ]);
});

test('getAnnPermutationImportanceView expands all rows and collapses back to the preview label', () => {
  const view = getAnnPermutationImportanceView(createSummary(7), {
    isExpanded: true,
    limit: 5,
  });

  assert.equal(view.totalCount, 7);
  assert.equal(view.visibleCount, 7);
  assert.equal(view.hiddenCount, 0);
  assert.equal(view.hasHiddenRows, false);
  assert.equal(view.statusLabel, 'Showing all 7 inputs');
  assert.equal(view.toggleLabel, 'Show top 5');
  assert.equal(view.rows.at(-1)?.dimensionLabel, 'feature-7');
});

test('getAnnPermutationImportanceView omits expansion controls when all rows fit', () => {
  const view = getAnnPermutationImportanceView(createSummary(3), {
    isExpanded: false,
    limit: 5,
  });

  assert.equal(view.visibleCount, 3);
  assert.equal(view.hiddenCount, 0);
  assert.equal(view.hasHiddenRows, false);
  assert.equal(view.statusLabel, 'Showing all 3 inputs');
  assert.equal(view.toggleLabel, null);
});

test('getAnnPermutationImportanceView groups related feature-impact rows by feature family', () => {
  const summary = createSummary(5);
  summary.rows = [
    {
      ...summary.rows[0],
      dimensionIndex: 0,
      dimensionLabel: 'mfccMeans[0]',
      accuracyDrop: 0.25,
      accuracyDropLabel: '25.0 pts drop',
      confidenceDrop: 0.14,
      confidenceDropLabel: '14.0 pts confidence drop',
    },
    {
      ...summary.rows[1],
      dimensionIndex: 1,
      dimensionLabel: 'mfccStdDevs[0]',
      accuracyDrop: 0.1,
      accuracyDropLabel: '10.0 pts drop',
      confidenceDrop: 0.08,
      confidenceDropLabel: '8.0 pts confidence drop',
    },
    {
      ...summary.rows[2],
      dimensionIndex: 2,
      dimensionLabel: 'spectralContrastMeans[2]',
      accuracyDrop: 0.2,
      accuracyDropLabel: '20.0 pts drop',
      confidenceDrop: 0.04,
      confidenceDropLabel: '4.0 pts confidence drop',
    },
    {
      ...summary.rows[3],
      dimensionIndex: 3,
      dimensionLabel: 'spectralContrastStdDevs[2]',
      accuracyDrop: 0,
      accuracyDropLabel: 'No accuracy drop',
      confidenceDrop: 0.03,
      confidenceDropLabel: '3.0 pts confidence drop',
    },
    {
      ...summary.rows[4],
      dimensionIndex: 4,
      dimensionLabel: 'energy',
      accuracyDrop: 0.05,
      accuracyDropLabel: '5.0 pts drop',
      confidenceDrop: 0.02,
      confidenceDropLabel: '2.0 pts confidence drop',
    },
  ];

  const view = getAnnPermutationImportanceView(summary);

  assert.equal(view.groups.length, 3);
  assert.deepEqual(view.groups.map(group => group.groupLabel), ['MFCC', 'Spectral Contrast', 'Energy']);
  assert.equal(view.groups[0].rowCount, 2);
  assert.equal(view.groups[0].inputCountLabel, '2 related inputs');
  assert.equal(view.groups[0].topDimensionLabel, 'mfccMeans[0]');
  assert.equal(view.groups[0].accuracyDropLabel, '25.0 pts drop');
  assert.equal(view.groups[0].confidenceDropLabel, '14.0 pts confidence drop');
  assert.equal(view.groups[0].summaryLabel, 'MFCC: 2 related inputs; top input mfccMeans[0]; 25.0 pts drop.');
});
