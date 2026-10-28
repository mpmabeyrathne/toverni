import { describe, expect, it } from 'vitest';
import {
  loadApprovedFormFixture,
  resolveApprovedFormValue,
} from './approved-form-fixtures.js';

describe('approved form fixtures', () => {
  it('resolves an explicitly approved field for exactly the approved origin', () => {
    const fixture = loadApprovedFormFixture(
      'https://practice.expandtesting.com',
      { Username: 'TOVERNI_TEST_USERNAME', Password: 'TOVERNI_TEST_PASSWORD' },
      { TOVERNI_TEST_USERNAME: 'practice', TOVERNI_TEST_PASSWORD: 'demo-test-value' },
    );
    expect(resolveApprovedFormValue(fixture,
      'https://practice.expandtesting.com/login', 'Password')).toBe('demo-test-value');
    expect(resolveApprovedFormValue(fixture,
      'https://practice.expandtesting.com/login', ' username ')).toBe('practice');
    expect(resolveApprovedFormValue(fixture,
      'https://practice.expandtesting.com.evil.example/login', 'Password')).toBeUndefined();
    expect(resolveApprovedFormValue(fixture,
      'http://practice.expandtesting.com/login', 'Password')).toBeUndefined();
  });

  it('rejects missing secrets and unapproved field names', () => {
    expect(() => loadApprovedFormFixture('https://example.com',
      { Password: 'TEST_PASSWORD' }, {})).toThrow(/Missing approved fixture/);
    expect(() => loadApprovedFormFixture('https://example.com',
      { Password: 'secret-inline' }, {})).toThrow(/named environment/);
    expect(resolveApprovedFormValue(
      { origin: 'https://example.com', fields: { Password: 'fixture' } },
      'https://example.com/login', 'API key')).toBeUndefined();
  });

  it('rejects path-scoped and malformed approval origins', () => {
    expect(resolveApprovedFormValue(
      { origin: 'https://example.com/login', fields: { Password: 'fixture' } },
      'https://example.com/login', 'Password')).toBeUndefined();
    expect(resolveApprovedFormValue(
      { origin: 'not-an-origin', fields: { Password: 'fixture' } },
      'https://example.com/login', 'Password')).toBeUndefined();
  });
});
