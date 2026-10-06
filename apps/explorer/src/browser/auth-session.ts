export interface AuthenticatedLandingInput {
  requestedUrl:
    string;

  actualUrl:
    string;

  title:
    string;
}

function looksLikeLoginPath(
  url:
    string,
): boolean {
  let pathname:
    string;

  try {
    pathname =
      new URL(
        url,
      ).pathname;
  } catch {
    return false;
  }

  return /(?:^|\/)(?:login|log-in|signin|sign-in)(?:\/|$)/i
    .test(
      pathname,
    );
}

function looksLikeLoginTitle(
  title:
    string,
): boolean {
  return /\b(?:log\s*in|sign\s*in)\b/i
    .test(
      title,
    );
}

export function assertAuthenticatedLanding(
  input:
    AuthenticatedLandingInput,
): void {
  if (
    looksLikeLoginPath(
      input.actualUrl,
    ) ||
    looksLikeLoginTitle(
      input.title,
    )
  ) {
    throw new Error(
      [
        'Saved authentication state appears invalid or expired.',
        `Requested: ${input.requestedUrl}`,
        `Landed on: ${input.actualUrl}`,
        'Refresh the Playwright storageState file and retry.',
      ].join(
        ' ',
      ),
    );
  }
}
