import type { ExecaReturnValue, Options } from 'execa';
import { execa } from 'execa';

const maxBuffer = 20 * 1024 * 1024;

/**
 * Execute a command asynchronously using execa
 * @param {string} cmd
 * @param {string[]} args
 */
export async function exec(
  cmd: string,
  args: string[] = [],
  opts: Options = {},
): Promise<ExecaReturnValue<string>> {
  return await execa(cmd, args, {
    ...opts,
    maxBuffer,
    encoding: 'utf8',
    reject: false,
  });
}
