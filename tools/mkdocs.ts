import { Command } from 'commander';
import fs from 'fs-extra';
import { logger } from '../lib/logger';
import { generateDocs } from './docs';
import { exec } from './utils/exec';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('pnpm build:mkdocs')
  .description('Build mkdocs')
  .option('--build <boolean>', 'build docs from source', (s) =>
    s ? s !== 'false' : undefined,
  );

void (async () => {
  await program.parseAsync();
  const opts = program.opts();
  logger.info('validating docs');
  if (opts.build) {
    logger.info('* generate docs');
    await generateDocs('tools/mkdocs', false);
  } else {
    logger.info('* using prebuild docs');
    await fs.copy('tmp/docs', 'tools/mkdocs/docs');
  }
  logger.info('* running mkdocs build');
  const res = exec('pdm', ['run', 'mkdocs', 'build'], {
    cwd: 'tools/mkdocs',
  });
  if (res.signal) {
    logger.error(`Signal received: ${res.signal}`);
    process.exit(-1);
  } else if (res.status && res.status !== 0) {
    logger.error(`Error occured:\n${res.stderr || res.stdout}`);
    process.exit(res.status);
  } else {
    logger.debug(`Build succeeded:\n${res.stdout || res.stderr}`);
  }
})();
