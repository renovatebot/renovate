import { Command } from 'commander';
import fs from 'fs-extra';
import { logger } from '../lib/logger/index.ts';
import { generateDocs } from './docs/index.ts';
import { bake } from './utils/docker.ts';
import { exec } from './utils/exec.ts';
import { parseVersion } from './utils/index.ts';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('pnpm release:prepare')
  .description('Build docker images')
  .option('--platform <type>', 'docker platforms to build')
  .option('--version <version>', 'version to use as tag', parseVersion)
  .option('--channel <channel>', 'channel to use as tag')
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
  logger.info(`Preparing v${opts.version?.toString()} ...`);
  build();
  await generateDocs(undefined, undefined, opts.version?.toString());
  await buildMkdocs(opts.version?.toString());
  await bake('build', opts);
})();

function build(): void {
  logger.info('Building ...');
  const res = exec('pnpm', ['build']);

  if (res.signal) {
    logger.error(`Signal received: ${res.signal}`);
    process.exit(-1);
  } else if (res.exitCode) {
    logger.error(`Error occured:\n${res.stderr || res.stdout}`);
    process.exit(res.exitCode);
  } else {
    logger.debug(`Build succeeded:\n${res.stdout || res.stderr}`);
  }
}

async function buildMkdocs(version: string | undefined): Promise<void> {
  logger.info('Building Mkdocs site ...');

  const mkdocsArgs = ['mkdocs', 'build'];
  if (version) {
    mkdocsArgs.push('--version', version);
  }

  const mkdocsRes = exec('pnpm', mkdocsArgs);

  if (mkdocsRes.signal) {
    logger.error(`Signal received: ${mkdocsRes.signal}`);
    process.exit(-1);
  } else if (mkdocsRes.exitCode) {
    logger.error(
      `Error occurred building mkdocs:\n${mkdocsRes.stderr || mkdocsRes.stdout}`,
    );
    process.exit(mkdocsRes.exitCode);
  } else {
    logger.debug(
      `Mkdocs build succeeded:\n${mkdocsRes.stdout || mkdocsRes.stderr}`,
    );
  }

  // Package the mkdocs site to attach to the release
  logger.info('Packaging Mkdocs site ...');
  await fs.ensureDir('tmp');

  const tarRes = exec('tar', [
    '-czf',
    'tmp/mkdocs-site.tgz',
    '-C',
    'tools/mkdocs/site',
    '.',
  ]);

  if (tarRes.signal) {
    logger.error(`Signal received: ${tarRes.signal}`);
    process.exit(-1);
  } else if (tarRes.exitCode) {
    logger.error(
      `Error occurred creating mkdocs-site.tgz:\n${tarRes.stderr || tarRes.stdout}`,
    );
    process.exit(tarRes.exitCode);
  } else {
    logger.info('Mkdocs site packaged successfully to tmp/mkdocs-site.tgz');
  }
}
