import { resolve } from 'node:path';
import { execa } from 'execa';
import { type Checkout, withCheckout } from './checkout.ts';
import { runChecks } from './checks.ts';
import { packageScript } from './script.ts';
import { selectChangedTests } from './test/select.ts';

async function runSelectedTests(checkout: Checkout): Promise<boolean> {
  const { selected, matchCount } = await selectChangedTests(checkout);
  if (selected.length === 0) {
    return true;
  }

  if (selected.length < matchCount) {
    console.log(
      `Test selection limited: ${selected.length} of ${matchCount} matching test files selected.`,
    );
  }

  const [command, ...args] = packageScript(
    'vitest',
    '--coverage.enabled=false',
    '--silent=passed-only',
    '--bail=1',
    '--no-file-parallelism',
    ...selected.map((file) => resolve(file)),
  );
  const result = await execa(command, args, {
    reject: false,
    stdio: 'inherit',
  });
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

  await withCheckout(run);
}

async function run(readCheckout: () => Promise<Checkout>): Promise<void> {
  const failures = await runChecks(readCheckout);

  try {
    if (!(await runSelectedTests(await readCheckout()))) {
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

await main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
