export const commandLock = 'pixi lock --no-progress --color=never --quiet';

/**
 * There is no way to know which version we should pick based on `pixi.toml` and `pixi.lock`
 * so we need to maintain a mapping from pixi version and it's generated lock file version.
 *
 * it should support lock version < 6 but old version of pixi doesn't release the binary we need, so just skip them and support only lock file version >=6
 *
 */
const pixiGenerateLockFileVersion: Config[] = [
  { lockVersion: 6, range: '>=0.39.2, <=0.41.4', cmd: commandLock },
] as const;

interface Config {
  lockVersion: number;
  range: string;
  cmd: string;
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
