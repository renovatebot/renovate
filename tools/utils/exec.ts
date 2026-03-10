import type {
  ExecaReturnValue,
  ExecaSyncReturnValue,
  Options,
  SyncOptions,
} from 'execa';
import { execa, execaSync } from 'execa';

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

/**
 * Execute a command asynchronously using execa
 * @param {string} cmd
 * @param {string[]} args
 */
export async function execAsync(
  cmd: string,
  args: string[] = [],
  opts: Options = {},
): Promise<ExecaReturnValue> {
  return await execa(cmd, args, {
    ...opts,
    maxBuffer,
    encoding: 'utf8',
  });
}
