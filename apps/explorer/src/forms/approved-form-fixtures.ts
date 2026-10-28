/** Approved test values are provided by the operator, never scraped from page text. */
export interface ApprovedFormFixture {
  origin: string;
  fields: Record<string, string>;
}

export function resolveApprovedFormValue(
  fixture: ApprovedFormFixture | undefined,
  pageUrl: string,
  fieldLabel: string,
): string | undefined {
  if (!fixture) return undefined;
  let observed: URL;
  let approved: URL;
  try {
    observed = new URL(pageUrl);
    approved = new URL(fixture.origin);
  } catch {
    return undefined;
  }
  // Require exact origin and an origin-only approval scope, never prefix matching.
  if (observed.origin !== approved.origin ||
      approved.pathname !== '/' || approved.search || approved.hash ||
      !['https:', 'http:'].includes(approved.protocol)) return undefined;

  const normalize = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
  const key = normalize(fieldLabel);
  const matches = Object.entries(fixture.fields).filter(
    ([label]) => normalize(label) === key,
  );
  if (matches.length !== 1) return undefined;
  const value = matches[0]?.[1];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Only allow named environment variables; do not place raw secrets in fixture files. */
export function loadApprovedFormFixture(
  origin: string,
  fieldEnvNames: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env,
): ApprovedFormFixture {
  const fields: Record<string, string> = {};
  for (const [label, envName] of Object.entries(fieldEnvNames)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(envName)) {
      throw new Error('Fixture values must reference named environment variables');
    }
    const value = env[envName];
    if (!value) throw new Error(`Missing approved fixture environment variable: ${envName}`);
    fields[label] = value;
  }
  return { origin, fields };
}
