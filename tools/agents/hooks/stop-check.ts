import { exec } from './utils/exec.ts';

try {
  await exec('pnpm', ['lint-fix']);
} catch {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason: 'pnpm lint-fix failed — please fix the issues before finishing',
    }),
  );
}

try {
  await exec('pnpm', ['test']);
} catch {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason: 'pnpm test failed — please fix the issues before finishing',
    }),
  );
}
