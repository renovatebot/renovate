import { Command } from 'commander';
import { logger } from '../lib/logger';
import { parseVersion } from './utils';
import { bake, sign } from './utils/docker';

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
  .option('--exit-on-error <boolean>', 'exit on docker error', (s) =>
    s ? s !== 'false' : undefined,
  );

void (async () => {
  await program.parseAsync();
  const opts = program.opts();
  logger.info(`Publishing v${opts.version}...`);
  const meta = await bake('push', opts);

  if (meta?.['build-slim']?.['containerimage.digest']) {
    sign(
      `ghcr.io/${process.env.OWNER}/${process.env.FILE}${meta['build-slim']['containerimage.digest']}`,
      opts,
    );
    sign(
      `${process.env.FILE}/${process.env.FILE}${meta['build-slim']['containerimage.digest']}`,
      opts,
    );
  }

  if (meta?.['build-full']?.['containerimage.digest']) {
    sign(
      `ghcr.io/${process.env.OWNER}/${process.env.FILE}@${meta['build-full']['containerimage.digest']}`,
      opts,
    );
    sign(
      `${process.env.FILE}/${process.env.FILE}@${meta['build-full']['containerimage.digest']}`,
      opts,
    );
  }
})();
