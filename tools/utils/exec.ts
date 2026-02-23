import type { ExecaSyncReturnValue, SyncOptions } from 'execa';
import { execaSync } from 'execa';

const maxBuffer = 20 * 1024 * 1024;

/**
 * Execute a command synchronously using execa
 * @param {string} cmd
 * @param {string[]} args
 */
export function exec(
  cmd: string,
  args: string[] = [],
  opts: SyncOptions = {},
): ExecaSyncReturnValue<string> {
  return execaSync(cmd, args, {
    ...opts,
    maxBuffer,
    encoding: 'utf8',
  });
}
