import type {
    BenchmarkScenario,
  } from './benchmark-contracts.js';
  
  const stopWords =
    new Set([
      'the',
      'a',
      'an',
      'to',
      'of',
      'in',
      'on',
      'for',
      'and',
      'or',
      'with',
      'from',
      'is',
      'are',
      'be',
      'can',
      'should',
      'then',
  
      // Generic test/action language
      'use',
      'using',
      'click',
      'select',
      'enter',
      'verify',
      'check',
      'execute',
      'executed',
  
      // Generic browser/UI language
      'discovered',
      'observed',
      'button',
      'link',
      'input',
      'action',
      'application',
      'browser',
      'page',
      'state',
    ]);
  
  function tokenize(
    value:
      string,
  ): string[] {
    return value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        ' ',
      )
      .split(
        /\s+/,
      )
      .map(
        (token) =>
          token.trim(),
      )
      .filter(
        (token) =>
          token.length >=
            3 &&
          !stopWords.has(
            token,
          ),
      );
  }
  
  function isSupported(
    value:
      string,
  
    corpusTokens:
      Set<string>,
  ): boolean {
    const tokens =
      tokenize(
        value,
      );
  
    if (
      tokens.length ===
      0
    ) {
      return true;
    }
  
    const supportedTokens =
      tokens.filter(
        (token) =>
          corpusTokens.has(
            token,
          ),
      );
  
    return (
      supportedTokens.length /
        tokens.length >=
      0.6
    );
  }
  
  export function assessScenarioSupport(
    scenarios:
      BenchmarkScenario[],
  
    supportCorpus:
      string,
  ): BenchmarkScenario[] {
    const corpusTokens =
      new Set(
        tokenize(
          supportCorpus,
        ),
      );
  
    return scenarios.map(
      (scenario) => {
        /*
         * "Unsupported steps" measures actions the
         * test asks a user/browser to perform.
         *
         * Expected outcomes are assertions, not
         * execution steps, so they are not counted
         * here.
         */
        const unsupportedSteps =
          scenario.actions.filter(
            (action) =>
              !isSupported(
                action,
                corpusTokens,
              ),
          );
  
        return {
          ...scenario,
  
          unsupportedSteps,
        };
      },
    );
  }