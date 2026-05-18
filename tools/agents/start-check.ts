import { exec } from './utils/exec.ts';

// Install mise tools first (gracefully fail if mise is not installed)
try {
  await exec('mise', ['install']);
} catch {
  console.error('mise is not installed or failed — skipping');
}

// Install Node dependencies
await exec('pnpm', ['install']);
