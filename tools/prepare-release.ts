import { Command } from 'commander';
import { logger } from '../lib/logger';
import { generateDocs } from './docs';
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
  .option('--tries <tries>', 'number of tries for docker build', parseInt)
  .option(
    '--delay <delay>',
    'delay between tries for docker build (eg. 5s, 10m, 1h)',
    '30s',
  )
  .option('--exit-on-error [boolean]', 'exit on docker error', (s) =>
    s ? s !== 'false' : undefined,
  )
  .option('-d, --debug', 'output docker build');

void (async () => {
  await program.parseAsync();
  const opts = program.opts();
  logger.info(`Preparing v${opts.version} ...`);
  await generateDocs();
  await bake('build', opts, opts.tries);
})();
