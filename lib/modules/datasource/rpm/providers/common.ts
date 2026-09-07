import { isNullOrUndefined } from '@sindresorhus/is';
import type { ReleaseResult } from '../../types.ts';

type RpmVersionValue = boolean | number | string | null | undefined;

export function formatRpmVersion(
  ver: RpmVersionValue,
  rel?: RpmVersionValue,
): string | null {
  if (isNullOrUndefined(ver)) {
    return null;
  }

  const version = String(ver);

  if (isNullOrUndefined(rel)) {
    return version;
  }

  return `${version}-${String(rel)}`;
}

export function buildReleaseResult(
  versions: Iterable<string>,
): ReleaseResult | null {
  const uniqueVersions = [...new Set(versions)];

  if (uniqueVersions.length === 0) {
    return null;
  }

  return {
    releases: uniqueVersions.map((version) => ({ version })),
  };
}
