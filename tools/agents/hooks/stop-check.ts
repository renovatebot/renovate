import { exec } from './utils/exec.ts';
import { block } from './utils/output.ts';

try {
  await exec('pnpm', ['lint-fix']);
} catch {
  block('pnpm lint-fix failed — the issues must be resolved before finishing');
}

try {
  await exec('pnpm', ['test']);
} catch {
  block('pnpm test failed — the issues must be resolved before finishing');
}
