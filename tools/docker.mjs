import { Command } from 'commander';
import { bake } from './utils/docker.mjs';

const program = new Command('pnpm build:docker');

/**
 *
 * @param {string | undefined} val
 */
function parseInt(val) {
  if (!val) {
    return 0;
  }
  const r = Number.parseInt(val, 10);
  if (!Number.isFinite(r) || r < 0) {
    throw new Error(`Invalid number: ${val}`);
  }

  return r;
}

/**
 *
 * @param {string | undefined} val
 */
function parseVersion(val) {
  if (!val) {
    return val;
  }

  if (!/^\d+\.\d+\.\d+(?:-.+)?$/.test(val)) {
    throw new Error(`Invalid version: ${val}`);
  }

  return val;
}

program
  .command('build')
  .description('Build docker images')
  .option('--platform <type>', 'docker platforms to build')
  .option('--version <version>', 'version to use as tag', parseVersion)
  .option('--tries <tries>', 'number of tries on failure', parseInt)
  .action(async (opts) => {
    console.log('Building docker images ...');
    await bake('build', opts, opts.tries - 1);
  });

program
  .command('push')
  .description('Publish docker images')
  .option('--platform <type>', 'docker platforms to build')
  .option('--version <version>', 'version to use as tag', parseVersion)
  .action(async (opts) => {
    console.log('Publishing docker images ...');
    await bake('push', opts);
  });

void program.parseAsync();
