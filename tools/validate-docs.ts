import { logger } from '../lib/logger';
import { generateDocs } from './docs';
import { exec } from './utils/exec';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

void (async () => {
  logger.info('validating docs');
  logger.info('* generate docs');
  await generateDocs('tools/mkdocs', false);
  logger.info('* running mkdocs');
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
