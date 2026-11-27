import { exec } from '../../../utils/exec.ts';

export async function provision(cwd?: string): Promise<void> {
  const opts = { cwd, stdout: process.stderr, stderr: process.stderr };

  try {
    await exec('mise', ['install'], opts);
  } catch {
    console.error('mise is not installed or failed — skipping');
  }

  await exec('pnpm', ['install'], opts);
}
