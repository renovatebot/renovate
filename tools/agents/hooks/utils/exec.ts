import type { Options } from 'execa';
import { exec as execBase } from '../../../utils/exec.ts';

export async function exec(
  cmd: string,
  args: string[] = [],
  opts: Options = {},
): ReturnType<typeof execBase> {
  return await execBase(cmd, args, {
    stdout: process.stderr,
    stderr: process.stderr,
    env: { ...process.env, RENOVATE_AGENT_HOOK: '1' },
    ...opts,
  });
}
