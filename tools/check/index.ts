import { resolve } from 'node:path';
import { execa } from 'execa';
import { selectChangedTests } from './test/select.ts';
import { runCheck } from './tui.ts';

const checks = [
  ['Format', 'prettier-fix'],
  ['Type check', 'type-check:tsrs'],
  ['JSON schema', 'test-schema'],
  ['Oxlint', 'oxlint'],
  ['Biome', 'biome'],
  ['File names', 'ls-lint'],
  ['Markdown', 'markdown-lint'],
  ['Code examples', 'doc-fence-check'],
] as const;

async function runSelectedTests(): Promise<boolean> {
  const { selected, changedCount, matchCount } = await selectChangedTests();
  if (changedCount === 0) {
    console.log('Tests skipped: no net changes.');
    return true;
  }

  if (matchCount === 0) {
    const paths = changedCount === 1 ? 'path' : 'paths';
    console.log(
      `Tests skipped: no matches for ${changedCount} changed ${paths}.`,
    );
    return true;
  }

  if (selected.length < matchCount) {
    console.log(
      `Test selection limited: ${selected.length} of ${matchCount} matching test files selected.`,
    );
  }

  if (selected.length === 0) {
    return true;
  }

  const result = await execa(
    'pnpm',
    [
      '--loglevel=error',
      'vitest',
      '--coverage.enabled=false',
      '--silent=passed-only',
      '--bail=1',
      '--no-file-parallelism',
      ...selected.map((file) => resolve(file)),
    ],
    { reject: false, stdio: 'inherit' },
  );
  if (result.failed && result.exitCode === undefined) {
    throw new Error(result.shortMessage);
  }

  return !result.failed;
}

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    console.error('pnpm check takes no arguments.');
    process.exitCode = 2;
    return;
  }

  const failures: string[] = [];
  for (const [name, script] of checks) {
    if (!(await runCheck(name, script))) {
      failures.push(name);
    }
  }

  try {
    if (!(await runSelectedTests())) {
      failures.push('selected tests');
    }
  } catch (error) {
    console.error(error.message);
    failures.push('selected tests');
  }

  if (failures.length > 0) {
    console.error(`\nFailed: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

await main();
