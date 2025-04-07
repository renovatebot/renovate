/**
 * For project without `requires-pixi` in `pixi.toml`, we pick pixi version based on `pixi.lock`.
 *
 * So we need to maintain a mapping from pixi version and it's generated lock file version.
 *
 * We do not support pixi<0.40.0 so version<6 is ignored.
 *
 */
const pixiGenerateLockFileVersion: Config[] = [
  { lockVersion: 6, range: '>=0.40.0, <0.45.0a0' },
] as const;

interface Config {
  lockVersion: number;
  range: string;
}

export function pickConfig(lockVersion?: number): Config | null {
  if (!lockVersion) {
    return null;
  }

  for (const pixi of pixiGenerateLockFileVersion) {
    if (lockVersion === pixi.lockVersion) {
      return pixi;
    }
  }

  return null;
}
