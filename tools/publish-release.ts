import { Command } from 'commander';
import { logger } from '../lib/logger';
import { parseVersion } from './utils';
import { bake } from './utils/docker';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('pnpm release:prepare')
  .description('Build docker images')
  .option('--platform <type>', 'docker platforms to build')
  .option('--version <version>', 'version to use as tag', parseVersion)
  .option('--exit-on-error', 'exit on docker error')
  .option('-d, --debug', 'output docker build');

void (async () => {
  await program.parseAsync();
  const opts = program.opts();
  logger.info(`Publishing v${opts.version}...`);
  logger.info(`TODO: publish docker images`);
  await bake('push-cache', opts);
})();
