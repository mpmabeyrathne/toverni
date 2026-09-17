import { describe, expect, it } from 'vitest';

import { parseTargetUrl } from './parse-target.js';

describe('parseTargetUrl', () => {
  it('accepts a valid HTTP URL', () => {
    const result = parseTargetUrl(['https://example.com']);

    expect(result.targetUrl).toBe('https://example.com');
  });

  it('rejects an invalid URL', () => {
    expect(() => parseTargetUrl(['invalid-url'])).toThrow();
  });
});