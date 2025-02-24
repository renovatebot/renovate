/**
 * There is no way to know which version we should pick based on `pixi.toml` and `pixi.lock`
 * so we need to maintain a mapping from pixi version and it's generated lock file version.
 *
 * This list should be sorted by the pixi version.
 */
export const pixiGenerateLockFileVersion = [
  { lockVersion: 1, range: '<= 0.6.0' },
  { lockVersion: 2, range: '0.7.0' },
  { lockVersion: 3, range: '>= 0.8.0 <= 0.12.0' },
  { lockVersion: 4, range: '>= 0.13.0 <= 0.20.1' },
  { lockVersion: 5, range: '>= 0.21.0 <= 0.38.0' },
  { lockVersion: 6, range: '>= 0.39.0 <= 0.41.4' },
] as const;

export function pickPixiBasedOnLockVersion(
  version: number,
): string | undefined {
  for (const v of pixiGenerateLockFileVersion) {
    if (version === v.lockVersion) {
      return v.range;
    }
  }

  // istanbul ignore next
  return undefined;
}
