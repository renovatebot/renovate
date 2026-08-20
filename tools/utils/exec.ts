import type { ExecaReturnValue, Options } from 'execa';
import { execa } from 'execa';

const maxBuffer = 20 * 1024 * 1024;

/**
 * Execute a command asynchronously using execa
 */
export async function exec(
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
