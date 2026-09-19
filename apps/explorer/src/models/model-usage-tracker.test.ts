import {
    describe,
    expect,
    it,
  } from 'vitest';
  
  import {
    ModelUsageTracker,
  } from './model-usage-tracker.js';
  
  describe(
    'ModelUsageTracker',
    () => {
      it(
        'aggregates token usage and cost',
        () => {
          const tracker =
            new ModelUsageTracker();
  
          tracker.record({
            provider:
              'test',
  
            model:
              'cheap-model',
  
            promptTokens:
              100,
  
            completionTokens:
              20,
  
            totalTokens:
              120,
  
            estimatedCostUsd:
              0.01,
  
            durationMs:
              100,
  
            reasoningTier:
              'cheap',
          });
  
          tracker.record({
            provider:
              'test',
  
            model:
              'complex-model',
  
            promptTokens:
              200,
  
            completionTokens:
              50,
  
            totalTokens:
              250,
  
            estimatedCostUsd:
              0.03,
  
            durationMs:
              200,
  
            reasoningTier:
              'complex',
          });
  
          expect(
            tracker.getSummary(),
          ).toEqual({
            promptTokens:
              300,
  
            completionTokens:
              70,
  
            totalTokens:
              370,
  
            estimatedCostUsd:
              0.04,
          });
        },
      );
    },
  );