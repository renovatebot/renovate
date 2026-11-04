import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { Lockfile } from './schema.ts';

/**
 * Detects the Poetry version used to write a lock file: the exact version
 * from the header (Poetry 1.4+), or a constraint inferred from `lock-version`.
 */
export function getLockfilePoetryVersion(
  lockContents: string,
): string | undefined {
  const firstLine = lockContents.split('\n')[0];
  const headerVersion = regEx(/by Poetry (?<version>[\d\\.]+)/).exec(firstLine)
    ?.groups?.version;
  if (headerVersion) {
    return headerVersion;
  }

  const { val } = Result.parse(
    lockContents,
    Lockfile.transform(({ poetryConstraint }) => poetryConstraint),
  ).unwrap();
  return val;
}
