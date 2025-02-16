import { Command } from 'commander';
import { logger } from '../lib/logger';
import { parsePositiveInt, parseVersion } from './utils';
import { bake } from './utils/docker';

const program = new Command('pnpm build:docker');

program
  .command('build')
  .description('Build docker images')
  .option('--platform <type>', 'docker platforms to build')
  .option('--version <version>', 'version to use as tag', parseVersion)
  .option('--tries <tries>', 'number of tries on failure', parsePositiveInt)
  .option(
    '--delay <delay>',
    'delay between tries for docker build (eg. 5s, 10m, 1h)',
    '30s',
  )
  .option('--args <args...>', 'additional arguments to pass to docker build')
  .action(async (opts) => {
    logger.info('Building docker images ...');
    await bake('build', opts);
  });

program
  .command('push')
  .description('Publish docker images')
  .option('--platform <type>', 'docker platforms to build')
  .option('--version <version>', 'version to use as tag', parseVersion)
  .action(async (opts) => {
    logger.info('Publishing docker images ...');
    await bake('push', opts);
  });

void program.parseAsync();
