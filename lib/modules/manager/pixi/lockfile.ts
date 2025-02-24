/**
 * There is no way to know which version we should pick based on `pixi.toml` and `pixi.lock`
 * so we need to maintain a mapping from pixi version and it's generated lock file version.
 *
 * This list should be sorted by the pixi version.
 */
export const pixiGenerateLockFileVersion: Array<{
  pixiVersion: string;
  lockVersion: number;
}> = [
  {
    pixiVersion: 'v0.0.4',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.0.5',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.0.6',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.0.7',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.0.8',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.1.0',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.2.0',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.3.0',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.4.0',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.5.0',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.6.0',
    lockVersion: 1,
  },
  {
    pixiVersion: 'v0.7.0',
    lockVersion: 2,
  },
  {
    pixiVersion: 'v0.8.0',
    lockVersion: 3,
  },
  {
    pixiVersion: 'v0.9.0',
    lockVersion: 3,
  },
  {
    pixiVersion: 'v0.9.1',
    lockVersion: 3,
  },
  {
    pixiVersion: 'v0.10.0',
    lockVersion: 3,
  },
  {
    pixiVersion: 'v0.11.0',
    lockVersion: 3,
  },
  {
    pixiVersion: 'v0.11.1',
    lockVersion: 3,
  },
  {
    pixiVersion: 'v0.12.0',
    lockVersion: 3,
  },
  {
    pixiVersion: 'v0.13.0',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.14.0',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.15.1',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.15.2',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.16.0',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.16.1',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.17.0',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.17.1',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.18.0',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.19.0',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.19.1',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.20.0',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.20.1',
    lockVersion: 4,
  },
  {
    pixiVersion: 'v0.21.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.21.1',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.22.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.23.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.24.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.24.1',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.24.2',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.25.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.26.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.26.1',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.27.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.27.1',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.28.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.28.1',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.28.2',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.29.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.30.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.31.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.32.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.32.1',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.32.2',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.33.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.34.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.35.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.36.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.37.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.38.0',
    lockVersion: 5,
  },
  {
    pixiVersion: 'v0.39.0',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.39.1',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.39.2',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.39.3',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.39.4',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.39.5',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.40.0',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.40.1',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.40.2',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.40.3',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.41.0',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.41.1',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.41.2',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.41.3',
    lockVersion: 6,
  },
  {
    pixiVersion: 'v0.41.4',
    lockVersion: 6,
  },
] as const;

const latestKnownVersion =
  pixiGenerateLockFileVersion[pixiGenerateLockFileVersion.length - 1];

export function pickPixiBasedOnLockVersion(
  version: number,
): string | undefined {
  if (version > latestKnownVersion.lockVersion) {
    // unknown lock file version, use latest
    return undefined;
  }

  for (const v of pixiGenerateLockFileVersion.toReversed()) {
    if (version === v.lockVersion) {
      return v.pixiVersion.replace(/^v/, '');
    }
  }

  // istanbul ignore next
  return undefined;
}
