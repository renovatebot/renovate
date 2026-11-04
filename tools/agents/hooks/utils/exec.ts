import type { Result } from 'execa';
import type { TextOptions } from '../../../utils/exec.ts';
import { exec as execBase } from '../../../utils/exec.ts';

export async function exec<T extends TextOptions = Record<never, never>>(
  cmd: string,
  args: string[] = [],
  opts?: T,
): Promise<Result<T & { encoding: 'utf8' }>> {
  return await execBase(cmd, args, {
    stdout: process.stderr,
    stderr: process.stderr,
    env: { ...process.env, RENOVATE_AGENT_HOOK: '1' },
    ...opts,
  } as T);
}
