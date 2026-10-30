import type { Options } from 'execa';
import { exec } from './exec.ts';

export async function provision(cwd?: string): Promise<void> {
  const opts: Options = cwd ? { cwd } : {};

  try {
    await exec('mise', ['install'], opts);
  } catch {
    console.error('mise is not installed or failed — skipping');
  }

  await exec('pnpm', ['install'], opts);
}
