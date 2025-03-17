import type { SpawnSyncReturns } from 'child_process';
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

const program = new Command('pnpm mkdocs').description('Run mkdocs');

program
  .command('build', { isDefault: true })
  .description('Build mkdocs')
  .option('--no-build', 'do not build docs from source')
  .option('--no-strict', 'do not build in strict mode')
  .action(async (opts) => {
    await prepareDocs(opts);
    logger.info('* running mkdocs build');
    const args = ['run', 'mkdocs', 'build'];
    if (opts.strict) {
      // args.push('--strict');
    }
    const res = exec('pdm', args, {
      cwd: 'tools/mkdocs',
      stdio: 'inherit',
    });
    checkResult(res);
  });

program
  .command('serve')
  .description('serve mkdocs')
  .option('--no-build', 'do not build docs from source')
  .option('--no-strict', 'do not build in strict mode')
  .action(async (opts) => {
    await prepareDocs(opts);
    logger.info('serving docs');
    logger.info('* running mkdocs serve');
    const args = ['run', 'mkdocs', 'serve'];
    if (opts.strict) {
      // args.push('--strict');
    }
    const res = exec('pdm', args, {
      cwd: 'tools/mkdocs',
      stdio: 'inherit',
    });
    checkResult(res);
  });

async function prepareDocs(opts: any): Promise<void> {
  logger.info('Building docs');
  if (opts.build) {
    logger.info('* generate docs');
    await generateDocs('tools/mkdocs', false);
  } else {
    logger.info('* using prebuild docs from build step');
    await fs.copy('tmp/docs', 'tools/mkdocs/docs');
  }
}

function checkResult(res: SpawnSyncReturns<string>): void {
  if (res.signal) {
    logger.error(`Signal received: ${res.signal}`);
    process.exit(-1);
  } else if (res.status && res.status !== 0) {
    logger.error(`Error occured:\n${res.stderr || res.stdout}`);
    process.exit(res.status);
  } else {
    logger.debug(`Build completed:\n${res.stdout || res.stderr}`);
  }
}

void program.parseAsync();
