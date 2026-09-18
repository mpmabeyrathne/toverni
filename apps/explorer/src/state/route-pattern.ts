const PAGINATION_QUERY_KEYS =
  new Set([
    'page',
    'p',
    'offset',
    'cursor',
    'limit',
    'per_page',
    'perPage',
    'pageSize',
    'page_size',
  ]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MONGO_ID_PATTERN =
  /^[0-9a-f]{24}$/i;

const LONG_HEX_PATTERN =
  /^[0-9a-f]{16,}$/i;

const NUMERIC_ID_PATTERN =
  /^\d+$/;

function normalizePathSegment(
  segment: string,
): string {
  if (
    UUID_PATTERN.test(segment) ||
    MONGO_ID_PATTERN.test(segment) ||
    LONG_HEX_PATTERN.test(segment) ||
    NUMERIC_ID_PATTERN.test(segment)
  ) {
    return ':id';
  }

  return segment;
}

export function deriveRoutePattern(
  value: string,
): string {
  const url = new URL(value);

  const segments =
    url.pathname
      .split('/')
      .map((segment) =>
        normalizePathSegment(
          segment,
        ),
      );

  const pathname =
    segments.join('/') || '/';

  const retainedParams =
    [...url.searchParams.entries()]
      .filter(
        ([key]) =>
          !PAGINATION_QUERY_KEYS.has(
            key,
          ),
      )
      .sort(
        ([firstKey], [secondKey]) =>
          firstKey.localeCompare(
            secondKey,
          ),
      );

  const query =
    new URLSearchParams(
      retainedParams,
    ).toString();

  return query
    ? `${pathname}?${query}`
    : pathname;
}