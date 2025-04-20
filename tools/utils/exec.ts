import {
  type SpawnSyncOptions,
  type SpawnSyncReturns,
  spawnSync,
} from 'node:child_process';

const maxBuffer = 20 * 1024 * 1024;

/**
 * Execute a command
 * @param {string} cmd
 * @param {string[]} args
 */
export function exec(
  cmd: string,
  args: string[] = [],
  opts: SpawnSyncOptions = {},
): SpawnSyncReturns<string> {
  // args from shelljs
  return spawnSync(cmd, args, { ...opts, maxBuffer, encoding: 'utf8' });
}
