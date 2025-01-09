import { Command } from 'commander';
import { logger } from '../lib/logger';
import { generateDocs } from './docs';
import { parseVersion } from './utils';
import { bake } from './utils/docker';
import { exec } from './utils/exec';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('pnpm release:prepare')
  .description('Build docker images')
  .option('--platform <type>', 'docker platforms to build')
  .option('--version <version>', 'version to use as tag', parseVersion)
  .option('--sha <type>', 'git sha')
  .option('--tries <tries>', 'number of tries for docker build', parseInt)
  .option(
    '--delay <delay>',
    'delay between tries for docker build (eg. 5s, 10m, 1h)',
    '30s',
  )
  .option('--exit-on-error <boolean>', 'exit on docker error', (s) =>
    s ? s !== 'false' : undefined,
  );

void (async () => {
  await program.parseAsync();
  const opts = program.opts();
  logger.info(`Preparing v${opts.version} ...`);
  build();
  await generateDocs();
  await bake('build', opts);
})();

function build(): void {
  logger.info('Building ...');
  const res = exec('pnpm', ['build']);

  if (res.signal) {
    logger.error(`Signal received: ${res.signal}`);
    process.exit(-1);
  } else if (res.status && res.status !== 0) {
    logger.error(`Error occured:\n${res.stderr || res.stdout}`);
    process.exit(res.status);
  } else {
    logger.debug(`Build succeeded:\n${res.stdout || res.stderr}`);
  }
}
