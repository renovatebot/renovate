export const commandLock = 'pixi lock --no-progress --color=never --quiet';
const commandList = 'pixi list';
const commandInstall = 'pixi install';

/**
 * There is no way to know which version we should pick based on `pixi.toml` and `pixi.lock`
 * so we need to maintain a mapping from pixi version and it's generated lock file version.
 *
 */
const pixiGenerateLockFileVersion: Config[] = [
  { lockVersion: 1, range: '<=0.6.0', cmd: commandInstall },
  { lockVersion: 2, range: '==0.7.0', cmd: commandInstall },
  { lockVersion: 3, range: '>=0.8.0, <=0.12.0', cmd: commandInstall },
  { lockVersion: 4, range: '>=0.13.0, <=0.20.1', cmd: commandInstall },
  { lockVersion: 5, range: '>=0.21.0, <=0.38.0', cmd: commandList },
  { lockVersion: 6, range: '>=0.39.0, <=0.41.4', cmd: commandLock },
] as const;

interface Config {
  lockVersion: number;
  range: string;
  cmd: string;
}

export function pickConfig(lockVersion: number): Config | undefined {
  for (const pixi of pixiGenerateLockFileVersion) {
    if (lockVersion === pixi.lockVersion) {
      return pixi;
    }
  }

  return undefined;
}
