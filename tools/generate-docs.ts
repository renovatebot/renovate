import { Command } from 'commander';
import { logger } from '../lib/logger';
import { generateDocs } from './docs';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('pnpm build:docs')
  .description('Generate docs')
  .option('--mkdocs', 'generate docs for mkdocs')
  .action(async (opts) => {
    if (opts.mkdocs) {
      logger.info('Generating for mkdocs');
      await generateDocs('tools/mkdocs', false);
    } else {
      logger.info('Generating docs for testing');
      await generateDocs();
    }
    logger.info('Generation completed');
  });

void program.parseAsync();
