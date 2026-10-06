export const COMPETITIVE_FIXTURE_IDS = [
  'booking',
  'todo',
  'commerce',
  'auth-rbac',
  'checkout-form',
  'data-grid',
  'upload-retry',
] as const;

export type CompetitiveFixtureId =
  typeof COMPETITIVE_FIXTURE_IDS[
    number
  ];

export function resolveCompetitiveFixtureIds(
  value:
    string | undefined,
): CompetitiveFixtureId[] {
  if (!value) {
    return [
      ...COMPETITIVE_FIXTURE_IDS,
    ];
  }

  const requested =
    value
      .split(',')
      .map(
        (item) =>
          item.trim(),
      )
      .filter(
        Boolean,
      );

  const invalid =
    requested.filter(
      (item) =>
        !COMPETITIVE_FIXTURE_IDS
          .includes(
            item as
              CompetitiveFixtureId,
          ),
    );

  if (
    invalid.length >
    0
  ) {
    throw new Error(
      [
        'Unknown competitive fixture(s):',
        invalid.join(', '),
        'Supported:',
        COMPETITIVE_FIXTURE_IDS
          .join(', '),
      ].join(' '),
    );
  }

  return requested as
    CompetitiveFixtureId[];
}
